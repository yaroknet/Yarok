import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { contextFromToken } from "./auth/tokens.ts";
import { changes, type ChangeEvent } from "./events.ts";
import type { RequestContext } from "./policies.ts";
import { runInProject, type Project } from "./projects/context.ts";
import { canSee } from "./postgrest/engine.ts";
import { getTable } from "./schema.ts";

/**
 * Minimal Supabase Realtime server (Phoenix protocol) supporting postgres_changes subscriptions.
 * Speaks serializer vsn 1.0.0 (JSON objects, older supabase-js) and 2.0.0 (JSON arrays).
 */

interface Binding {
  id: number;
  event: string;
  schema: string;
  table?: string;
  filter?: string;
}

interface Channel {
  joinRef: string | null;
  bindings: Binding[];
  ctx: RequestContext;
}

interface Connection {
  ws: WebSocket;
  project: Project;
  vsn: "1.0.0" | "2.0.0";
  apikey: string | null;
  channels: Map<string, Channel>;
}

type Message = [string | null, string | null, string, string, any];

let nextBindingId = 1;
const connections = new Set<Connection>();

function send(conn: Connection, msg: Message) {
  if (conn.ws.readyState !== conn.ws.OPEN) return;
  const [join_ref, ref, topic, event, payload] = msg;
  conn.ws.send(JSON.stringify(conn.vsn === "1.0.0" ? { join_ref, ref, topic, event, payload } : msg));
}

function reply(conn: Connection, msg: Message, status: "ok" | "error", response: unknown = {}) {
  send(conn, [msg[0], msg[1], msg[2], "phx_reply", { status, response }]);
}

async function handleMessage(conn: Connection, raw: string) {
  let msg: Message;
  try {
    const parsed = JSON.parse(raw);
    msg = Array.isArray(parsed)
      ? parsed
      : [parsed.join_ref ?? null, parsed.ref ?? null, parsed.topic, parsed.event, parsed.payload];
  } catch {
    return;
  }
  const [joinRef, , topic, event, payload] = msg;

  if (topic === "phoenix" && event === "heartbeat") return reply(conn, msg, "ok");

  if (event === "phx_join") {
    let ctx: RequestContext;
    try {
      ctx = await contextFromToken(payload?.access_token ?? conn.apikey);
    } catch {
      return reply(conn, msg, "error", { reason: "Invalid JWT" });
    }
    const requested: Omit<Binding, "id">[] = payload?.config?.postgres_changes ?? [];
    const bindings = requested.map((b) => ({ ...b, id: nextBindingId++ }));
    conn.channels.set(topic, { joinRef, bindings, ctx });
    reply(conn, msg, "ok", {
      postgres_changes: bindings.map(({ id, event: e, schema, table, filter }) => ({ id, event: e, schema, table, filter })),
    });
    if (bindings.length) {
      send(conn, [joinRef, null, topic, "system", {
        channel: topic.replace(/^realtime:/, ""),
        extension: "postgres_changes",
        message: "Subscribed to PostgreSQL",
        status: "ok",
      }]);
    }
    return;
  }

  if (event === "access_token") {
    const channel = conn.channels.get(topic);
    if (channel && payload?.access_token) {
      try {
        channel.ctx = await contextFromToken(payload.access_token);
      } catch {
        // keep previous context
      }
    }
    return;
  }

  if (event === "phx_leave") {
    conn.channels.delete(topic);
    return reply(conn, msg, "ok");
  }

  // broadcast / presence are not used by the app; acknowledge so clients don't time out
  if (msg[1]) reply(conn, msg, "ok");
}

function filterMatches(filter: string | undefined, record: Record<string, unknown> | null): boolean {
  if (!filter) return true;
  const m = /^([^=]+)=(eq|neq|in)\.(.*)$/.exec(filter);
  if (!m || !record) return true;
  const [, column, op, value] = m;
  const actual = record[column] == null ? null : String(record[column]);
  if (op === "eq") return actual === value;
  if (op === "neq") return actual !== value;
  return value.replace(/^\(|\)$/g, "").split(",").includes(actual ?? "");
}

async function dispatch(event: ChangeEvent) {
  for (const conn of connections) {
    if (conn.project.name !== event.project) continue;
    for (const [topic, channel] of conn.channels) {
      const ids = channel.bindings
        .filter(
          (b) =>
            (b.schema === "*" || b.schema === "public") &&
            (!b.table || b.table === "*" || b.table === event.table) &&
            (b.event === "*" || b.event.toUpperCase() === event.type) &&
            filterMatches(b.filter, event.record ?? event.old_record),
        )
        .map((b) => b.id);
      if (ids.length === 0) continue;

      let record = event.record;
      let oldRecord = event.old_record;
      if (event.type === "DELETE") {
        // Like Supabase with RLS enabled, deletes only expose the primary key
        const pk = getTable(event.table)?.pk ?? "id";
        oldRecord = oldRecord ? { [pk]: oldRecord[pk] } : null;
      } else if (!record || !(await canSee(event.table, record, channel.ctx))) {
        continue;
      }
      if (event.type === "UPDATE" && oldRecord) {
        const pk = getTable(event.table)?.pk ?? "id";
        oldRecord = { [pk]: oldRecord[pk] };
      }
      send(conn, [channel.joinRef, null, topic, "postgres_changes", {
        ids,
        data: {
          schema: "public",
          table: event.table,
          commit_timestamp: event.commit_timestamp,
          type: event.type,
          columns: [],
          record: record ?? {},
          old_record: oldRecord ?? {},
          errors: null,
        },
      }]);
    }
  }
}

export function attachRealtime(server: Server, projects: Record<string, Project>) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const m = /^\/api\/([^/]+)\/realtime\/v1\/websocket$/.exec(url.pathname);
    const project = m ? projects[m[1]] : undefined;
    if (!project) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn: Connection = {
        ws,
        project,
        vsn: url.searchParams.get("vsn") === "2.0.0" ? "2.0.0" : "1.0.0",
        apikey: url.searchParams.get("apikey"),
        channels: new Map(),
      };
      connections.add(conn);
      ws.on("message", (data) => void runInProject(project, () => handleMessage(conn, data.toString())));
      ws.on("close", () => connections.delete(conn));
      ws.on("error", () => connections.delete(conn));
    });
  });
  changes.on("change", (e: ChangeEvent) => {
    const project = projects[e.project];
    if (!project) return;
    runInProject(project, () => dispatch(e)).catch((err) => console.error("[realtime]", err));
  });
}
