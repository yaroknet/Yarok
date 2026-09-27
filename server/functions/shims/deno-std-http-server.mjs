// Stand-in for https://deno.land/std/http/server.ts used by older edge functions
export function serve(handler, options) {
  return globalThis.Deno.serve(options ?? {}, handler);
}
