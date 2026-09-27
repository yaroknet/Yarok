import { EventEmitter } from "node:events";
import { currentProject } from "./projects/context.ts";

export type ChangeType = "INSERT" | "UPDATE" | "DELETE";

export interface ChangeEvent {
  project: string;
  table: string;
  type: ChangeType;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
  commit_timestamp: string;
}

export const changes = new EventEmitter();
changes.setMaxListeners(0);

export function emitChange(
  table: string,
  type: ChangeType,
  record: Record<string, unknown> | null,
  old_record: Record<string, unknown> | null,
) {
  const event: ChangeEvent = {
    project: currentProject().name,
    table,
    type,
    record,
    old_record,
    commit_timestamp: new Date().toISOString(),
  };
  setImmediate(() => changes.emit("change", event));
}
