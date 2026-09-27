import { config } from "./config.ts";

/**
 * The edge functions call hard-coded automation webhooks (Make.com, n8n) and push / email
 * services that reach real people. Unless WEBHOOK_DRY_RUN=false, those calls are logged instead.
 */
const BLOCKED_HOSTS = [/(^|\.)make\.com$/, /(^|\.)n8n\.cloud$/, /(^|\.)n8n\.io$/, /^n8n\./, /(^|\.)resend\.com$/];

export function isBlockedWebhook(url: string): boolean {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  const extra = (process.env.DRY_RUN_EXTRA_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return BLOCKED_HOSTS.some((re) => re.test(host)) || extra.includes(host);
}

export function installWebhookDryRun() {
  if (!config.webhookDryRun) {
    console.log("[webhooks] LIVE mode: external webhooks will be called");
    return;
  }
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isBlockedWebhook(url)) {
      let body: unknown = init?.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // keep raw string
        }
      }
      const shown = typeof body === "string" || body === undefined ? body : JSON.stringify(body, null, 2);
      console.log(`[webhooks] DRY RUN — not sent to ${url}:\n${String(shown ?? "").slice(0, 4000)}`);
      return new Response(JSON.stringify({ ok: true, dryRun: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  };
  console.log("[webhooks] dry-run mode: Make.com / n8n / email webhooks are logged, not sent (WEBHOOK_DRY_RUN=false to send)");
}
