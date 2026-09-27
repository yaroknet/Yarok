// Edge Function: sync-to-external-supabase
// One-way incremental sync from Lovable Cloud → external Supabase project.
// Runs hourly via pg_cron. Triggered manually with a CRON_SECRET Bearer token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOCAL_URL = Deno.env.get("SUPABASE_URL")!;
const LOCAL_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXTERNAL_SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

const TABLES = ["clients", "proposals", "contact_inquiries", "complaints"] as const;
const BATCH_SIZE = 500;

const local = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function upsertExternal(table: string, rows: unknown[]) {
  // Use PostgREST upsert with on-conflict on the primary key `id`.
  const res = await fetch(
    `${EXTERNAL_URL}/rest/v1/${table}?on_conflict=id`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EXTERNAL_SERVICE_KEY,
        "Authorization": `Bearer ${EXTERNAL_SERVICE_KEY}`,
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`External upsert failed [${res.status}] on ${table}: ${body}`);
  }
}

async function syncTable(table: string) {
  const startedAt = new Date().toISOString();
  const { data: state, error: stateErr } = await local
    .from("external_sync_state")
    .select("last_synced_at")
    .eq("table_name", table)
    .maybeSingle();
  if (stateErr) throw stateErr;

  const since = state?.last_synced_at ?? "1970-01-01T00:00:00Z";
  let cursor = since;
  let totalRows = 0;
  let maxUpdatedAt = since;

  // Loop pages ordered by updated_at asc.
  while (true) {
    const { data: rows, error } = await local
      .from(table)
      .select("*")
      .gt("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    await upsertExternal(table, rows);
    totalRows += rows.length;
    const last = rows[rows.length - 1] as { updated_at: string };
    maxUpdatedAt = last.updated_at;

    if (rows.length < BATCH_SIZE) break;
    cursor = last.updated_at;
  }

  if (totalRows > 0) {
    await local
      .from("external_sync_state")
      .update({ last_synced_at: maxUpdatedAt, updated_at: new Date().toISOString() })
      .eq("table_name", table);
  }

  await local.from("external_sync_log").insert({
    table_name: table,
    rows_synced: totalRows,
    status: "success",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return { table, rows_synced: totalRows, since, until: maxUpdatedAt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: unknown[] = [];
  for (const table of TABLES) {
    try {
      results.push(await syncTable(table));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`sync failed for ${table}:`, msg);
      await local.from("external_sync_log").insert({
        table_name: table,
        rows_synced: 0,
        status: "error",
        error_message: msg,
        finished_at: new Date().toISOString(),
      });
      results.push({ table, error: msg });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
