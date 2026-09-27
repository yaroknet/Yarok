// Node module resolution hook: lets the original Deno edge functions in */supabase/functions
// run unmodified by mapping their esm.sh / npm: / deno.land imports to installed packages.

const HERE = import.meta.url;
const SHIMS = {
  "https://deno.land/std/http/server.ts": new URL("./shims/deno-std-http-server.mjs", HERE).href,
};

function toPackage(specifier) {
  let s = specifier;
  if (s.startsWith("https://esm.sh/")) s = s.slice("https://esm.sh/".length);
  else if (s.startsWith("npm:")) s = s.slice(4);
  else return null;
  // drop version: @scope/name@1.2.3/sub -> @scope/name/sub
  return s.replace(/^((?:@[^/]+\/)?[^@/]+)@[^/]+/, "$1").replace(/\?.*$/, "");
}

export async function resolve(specifier, context, nextResolve) {
  // https://deno.land/std@0.168.0/http/server.ts -> local shim
  const std = specifier.replace(/^https:\/\/deno\.land\/std@[^/]+\//, "https://deno.land/std/");
  if (SHIMS[std]) return nextResolve(SHIMS[std], context);
  // https://deno.land/x/zod@v3.22.4/mod.ts -> zod; the xhr polyfill is not needed on Node
  const x = /^https:\/\/deno\.land\/x\/([\w-]+)@[^/]+\/mod\.ts$/.exec(specifier);
  if (x?.[1] === "xhr") return nextResolve(new URL("./shims/empty.mjs", HERE).href, context);
  if (x) return nextResolve(x[1], context);

  const pkg = toPackage(specifier);
  if (!pkg) return nextResolve(specifier, context);
  // supabase-js always comes from the server's install (Deno resolved "@2" to the latest release)
  if (pkg === "@supabase/supabase-js" || pkg.startsWith("@supabase/supabase-js/")) {
    return nextResolve(pkg, { ...context, parentURL: HERE });
  }
  return nextResolve(pkg, context);
}
