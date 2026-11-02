/**
 * End-to-end check of WhatsApp (Green API) and email (SMTP) sending, against local mocks only:
 *   npm run test:messaging
 * Starts a mock Green API server, a local SMTP catcher and a second backend on port 3199 with a throwaway
 * database, runs the messaging functions with sending on, then again in dry-run mode, and drops the database.
 * Never contacts the real Green API or a real mail server.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { simpleParser, type ParsedMail } from "mailparser";
import { MongoClient } from "mongodb";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { SMTPServer } from "smtp-server";
import { config } from "../config.ts";
import { cronSecret as cronSecretValue, serviceRoleKey } from "../projects/keys.ts";

const API_PORT = 3199;
const API = `http://localhost:${API_PORT}`;
const TEST_DB = "yarok_messaging_test";
const INSTANCE = "1101000001";
const TOKEN = "mock-token";
const FAILING_PHONE = "050-000-0500";

let failures = 0;
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail === undefined ? "" : JSON.stringify(detail, null, 1).slice(0, 1500));
  }
}

// ---------- mocks ----------
interface WaCall {
  path: string;
  body: { chatId: string; message?: string; urlFile?: string };
}
const waCalls: WaCall[] = [];
const green = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    waCalls.push({ path: req.url ?? "", body });
    const failing = String(body.chatId).startsWith("972500000500");
    res.writeHead(failing ? 500 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(failing ? { message: "mock failure" } : { idMessage: `MOCK${waCalls.length}` }));
  });
});

const mails: ParsedMail[] = [];
const smtp = new SMTPServer({
  secure: false,
  disabledCommands: ["STARTTLS"],
  allowInsecureAuth: true,
  logger: false,
  onAuth: (auth, _s, cb) =>
    auth.username === "office@yarok.test" && auth.password === "smtp-pass" ? cb(null, { user: auth.username }) : cb(new Error("bad login")),
  onRcptTo: (addr, _s, cb) =>
    addr.address.startsWith("reject@") ? cb(Object.assign(new Error("Mailbox unavailable"), { responseCode: 550 })) : cb(),
  onData: (stream, _s, cb) => {
    simpleParser(stream)
      .then((m) => {
        mails.push(m);
        cb();
      })
      .catch(cb);
  },
});

const listen = (server: { listen: (port: number, host: string, cb: () => void) => unknown }, s: { address(): unknown }) =>
  new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((s.address() as AddressInfo).port)));

// ---------- backend ----------
let backend: ChildProcess | null = null;
let backendLog = "";
async function startBackend(env: Record<string, string | undefined>) {
  backendLog = "";
  const merged: Record<string, string | undefined> = {
    ...process.env,
    PORT: String(API_PORT),
    API_URL: API,
    SITE_URL: "http://localhost:8090",
    MONGODB_DB: TEST_DB,
    ENABLE_CRON: "false",
    ENABLE_DB_TRIGGERS: "false",
    ...env,
  };
  for (const [k, v] of Object.entries(merged)) if (v === undefined) delete merged[k];
  backend = spawn(path.join(config.root, "node_modules", ".bin", "tsx"), ["server/index.ts"], {
    cwd: config.root,
    env: merged as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  backend.stdout!.on("data", (d) => (backendLog += d));
  backend.stderr!.on("data", (d) => (backendLog += d));
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if (backendLog.includes("[functions]")) return;
    if (backend.exitCode !== null) break;
  }
  throw new Error(`backend did not start:\n${backendLog}`);
}
async function stopBackend() {
  if (!backend || backend.exitCode !== null) return;
  const done = new Promise((r) => backend!.once("exit", r));
  backend.kill("SIGTERM");
  await done;
}

// ---------- helpers ----------
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const ops = createClient(`${API}/api/ops`, serviceRoleKey(), opts);
const site = createClient(`${API}/api/site`, serviceRoleKey(), opts);

async function makeUser(client: SupabaseClient, email: string, name: string, phone: string | null, role: string | null) {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: "Test1234!",
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  if (phone) await client.from("profiles").update({ phone }).eq("user_id", data.user.id);
  if (role) await client.from("user_roles").insert({ user_id: data.user.id, role });
  return data.user.id;
}
async function signedIn(project: "ops" | "site", email: string) {
  const c = createClient(`${API}/api/${project}`, "public", opts);
  const { error } = await c.auth.signInWithPassword({ email, password: "Test1234!" });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}
async function invoke(client: SupabaseClient, fn: string, body: unknown) {
  const { data, error } = await client.functions.invoke(fn, { body: body as Record<string, unknown> });
  if (!error) return { status: 200, data };
  const ctx = (error as { context?: Response }).context;
  return { status: ctx?.status ?? 0, data: await ctx?.json?.().catch(() => null) };
}
const insertOne = async (client: SupabaseClient, table: string, row: Record<string, unknown>) => {
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data as Record<string, any>;
};
const mailTo = (m: ParsedMail) =>
  (Array.isArray(m.to) ? m.to : m.to ? [m.to] : []).flatMap((a) => a.value.map((v) => v.address ?? ""));
const isSaturdayIL = new Date(Date.now() + 3 * 3600_000).getUTCDay() === 6;

async function dropTestDb() {
  const mongo = new MongoClient(config.mongoUri);
  await mongo.connect();
  await mongo.db(TEST_DB).dropDatabase();
  await mongo.close();
}

// ---------- test ----------
async function main() {
  const greenPort = await listen(green, green);
  const smtpPort = await listen(smtp, smtp.server);
  const messagingEnv = {
    GREEN_API_URL: `http://127.0.0.1:${greenPort}`,
    GREEN_API_INSTANCE_ID: INSTANCE,
    GREEN_API_TOKEN: TOKEN,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtpPort),
    SMTP_SECURE: "false",
    SMTP_USER: "office@yarok.test",
    SMTP_PASS: "smtp-pass",
    SMTP_FROM: "ירוק <office@yarok.test>",
  };
  await dropTestDb();

  console.log(`Live mode (mock Green API :${greenPort}, mock SMTP :${smtpPort})`);
  await startBackend({ ...messagingEnv, MESSAGING_DRY_RUN: "false", WEBHOOK_DRY_RUN: undefined });
  check("backend reports live mode", backendLog.includes("[messaging] LIVE mode: WhatsApp via Green API, email via 127.0.0.1"), backendLog.slice(0, 600));

  // messaging API is service-role only
  const anonCall = await fetch(`${API}/api/ops/messaging/v1/whatsapp`, {
    method: "POST",
    headers: { Authorization: "Bearer public", "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "0501234567", message: "x" }),
  });
  check("messaging API rejects the public key", anonCall.status === 403, anonCall.status);

  // ---- Yarok 360 data ----
  const adminId = await makeUser(ops, "msgtest-admin@yarok.local", "מנהלת בדיקה", "052-111-2222", "super_admin");
  const workerId = await makeUser(ops, "msgtest-worker@yarok.local", "עובד בדיקה", "050-123-4567", "contractor");
  const failingId = await makeUser(ops, "msgtest-fail@yarok.local", "עובד כושל", FAILING_PHONE, "contractor");
  const network = await insertOne(ops, "networks", { name: "רשת בדיקה" });
  const branch = await insertOne(ops, "branches", { name: "סניף מרכז", network_id: network.id, address: "הרצל 1", city: "תל אביב" });

  console.log("whatsapp-notify (task)");
  const task = await insertOne(ops, "tasks", { branch_id: branch.id, work_type: "ניקוי ויטרינות", assigned_to: workerId, due_date: "2026-10-01" });
  let before = waCalls.length;
  const notify = await invoke(ops, "whatsapp-notify", { type: "new", task });
  const notifyCalls = waCalls.slice(before);
  if (isSaturdayIL) {
    check("Saturday: task message blocked", notify.data?.skipped === true && notifyCalls.length === 0, notify);
  } else {
    check("function answered success", notify.status === 200 && notify.data?.success, notify);
    const call = notifyCalls[0];
    check("Green API sendMessage URL", call?.path === `/waInstance${INSTANCE}/sendMessage/${TOKEN}`, call?.path);
    check("chatId normalized from 050-123-4567", call?.body.chatId === "972501234567@c.us", call?.body);
    check(
      "message has task details",
      call?.body.message?.includes("ניקוי ויטרינות") && call.body.message.includes("סניף מרכז") && call.body.message.includes("רשת בדיקה"),
      call?.body.message,
    );
    const { data: log } = await ops.from("whatsapp_log").select("*").eq("task_id", task.id);
    check("whatsapp_log row with webhook_status 200", log?.length === 1 && log[0].webhook_status === 200 && log[0].recipient_phone === "050-123-4567", log);

    const failTask = await insertOne(ops, "tasks", { branch_id: branch.id, work_type: "שטיפה", assigned_to: failingId });
    const failed = await invoke(ops, "whatsapp-notify", { type: "new", task: failTask });
    const { data: failLog } = await ops.from("whatsapp_log").select("webhook_status").eq("task_id", failTask.id);
    check("failed send logged with the Green API status (500)", failed.data?.recipients?.[0]?.status === 500 && failLog?.[0]?.webhook_status === 500, { failed, failLog });
  }

  console.log("whatsapp-daily-summary (scheduled summary)");
  before = waCalls.length;
  const summary = await invoke(ops, "whatsapp-daily-summary", {});
  const summaryCalls = waCalls.slice(before);
  if (isSaturdayIL) {
    check("Saturday: summary blocked", summary.data?.skipped === true && summaryCalls.length === 0, summary);
  } else {
    check("summary answered success", summary.status === 200 && summary.data?.zachi_status === 200 && summary.data?.orit_status === 200, summary);
    check(
      "summaries sent to צחי and אורית",
      summaryCalls.map((c) => c.body.chatId).sort().join() === "972503771149@c.us,972544552202@c.us",
      summaryCalls.map((c) => c.body.chatId),
    );
    check("summary lists the open task", summaryCalls.some((c) => c.body.message?.includes("ניקוי ויטרינות")), summaryCalls[0]?.body.message);
    const { data: sumLog } = await ops.from("whatsapp_log").select("webhook_status").eq("message_type", "summary");
    check("summary whatsapp_log rows with status 200", sumLog?.length === 2 && sumLog.every((r) => r.webhook_status === 200), sumLog);
  }

  console.log("send-quote (email to client)");
  const admin = await signedIn("ops", "msgtest-admin@yarok.local");
  const quote = await insertOne(ops, "quotes", {
    network_name_snapshot: "רשת בדיקה",
    branch_name: "סניף מרכז",
    contact_name: "ישראל ישראלי",
    contact_phone: "050-7654321",
    contact_email: "client@example.com",
    payment_terms: "שוטף + 30",
    materials: ["basic", "other"],
    materials_other_text: "סבון ידיים",
    total_amount: 1234,
    created_by: adminId,
  });
  await ops.from("quote_items").insert([
    { quote_id: quote.id, description: "ניקיון יומי", frequency: "יומי", price: 1000, sort_order: 1 },
    { quote_id: quote.id, description: "ניקוי חלונות", frequency: "חודשי", price: 234, sort_order: 2 },
  ]);
  const noAuth = await invoke(createClient(`${API}/api/ops`, "public", opts), "send-quote", { quoteId: quote.id });
  check("send-quote refuses a visitor without login", noAuth.status === 401, noAuth);

  let mailsBefore = mails.length;
  const sendQuote = await invoke(admin, "send-quote", { quoteId: quote.id });
  const quoteMail = mails[mailsBefore];
  check("send-quote answered ok", sendQuote.status === 200 && sendQuote.data?.ok, sendQuote);
  check("email To is the client", quoteMail && mailTo(quoteMail).join() === "client@example.com", quoteMail && mailTo(quoteMail));
  check("email From is the company mailbox", quoteMail?.from?.value[0]?.address === "office@yarok.test", quoteMail?.from);
  check("subject has the quote number", quoteMail?.subject === `הצעת מחיר #${quote.quote_number} מקבוצת ירוק — רשת בדיקה`, quoteMail?.subject);
  const qHtml = String(quoteMail?.html || "");
  check("HTML is Hebrew right-to-left", qHtml.includes('dir="rtl"') && qHtml.includes('lang="he"'));
  check("HTML has items, materials, terms", ["ניקיון יומי", "ניקוי חלונות", "כולל חומרים בסיסיים", "אחר: סבון ידיים", "שוטף + 30"].every((s) => qHtml.includes(s)));
  check("HTML links to the quote page", qHtml.includes(`http://localhost:8090/employees/quote/${quote.unique_token}`));
  check("plain-text version included", String(quoteMail?.text || "").includes(`/employees/quote/${quote.unique_token}`));
  const { data: sentQuote } = await ops.from("quotes").select("status,sent_at").eq("id", quote.id).single();
  check("quote marked sent", sentQuote?.status === "sent" && !!sentQuote.sent_at, sentQuote);

  const quote2 = await insertOne(ops, "quotes", { network_name_snapshot: "רשת בדיקה", contact_email: "reject@example.com", created_by: adminId });
  const failedQuote = await invoke(admin, "send-quote", { quoteId: quote2.id });
  const { data: q2 } = await ops.from("quotes").select("status").eq("id", quote2.id).single();
  check("rejected email -> 502 and quote stays draft", failedQuote.status === 502 && q2?.status === "draft", { failedQuote, q2 });

  console.log("quote-signed (email to accounting + manager)");
  const pngDot = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  await ops.from("quotes").update({
    status: "signed",
    signed_at: new Date().toISOString(),
    signer_name: "ישראל ישראלי",
    signer_id_number: "123456789",
    signature_data: `data:image/png;base64,${pngDot}`,
    notification_email: "manager@example.com",
  }).eq("id", quote.id);
  mailsBefore = mails.length;
  const signed = await invoke(createClient(`${API}/api/ops`, "public", opts), "quote-signed", { quoteId: quote.id });
  const signedMails = mails.slice(mailsBefore);
  check("quote-signed answered ok", signed.status === 200 && signed.data?.ok, signed);
  check(
    "one email per recipient (3 accounting + manager)",
    signedMails.map((m) => mailTo(m).join()).sort().join() === "feigi@yaroknet.co.il,manager@example.com,office@yaroknet.co.il,rotem@yaroknet.co.il",
    signedMails.map(mailTo),
  );
  const sm = signedMails[0];
  check("subject says the quote was signed", sm?.subject === `הצעת מחיר #${quote.quote_number} נחתמה — רשת בדיקה`, sm?.subject);
  // the parser replaces cid: references with the inline image data
  check(
    "HTML has signer and inline signature image",
    String(sm?.html).includes("123456789") && /src="(cid:signature|data:image\/png;base64,)/.test(String(sm?.html)),
    String(sm?.html).slice(0, 300),
  );
  check("signature attached inline", sm?.attachments.some((a) => a.cid === "signature" && a.contentType === "image/png"), sm?.attachments.map((a) => a.cid));

  console.log("procurement-send (purchase order to supplier)");
  const buyerId = await makeUser(site, "msgtest-buyer@yarok.local", "רוכש בדיקה", null, "super_admin");
  const buyer = await signedIn("site", "msgtest-buyer@yarok.local");
  const client = await insertOne(site, "clients", { name: "לקוח בדיקה" });
  const shipTo = await insertOne(site, "shipping_addresses", { site_name: "מחסן ראשי", address: "התעשייה 5, חולון", client_id: client.id });
  const item = await insertOne(site, "internal_catalog_items", { name: "נייר טואלט" });
  const supplier = await insertOne(site, "suppliers", {
    name: "ספק בדיקה",
    email: "supplier@example.com",
    contacts: [{ name: "דני", email: "orders@supplier.example", phone: "03-5555555" }],
  });
  const order = await insertOne(site, "procurement_orders", {
    created_by: buyerId,
    client_id: client.id,
    shipping_address_id: shipTo.id,
    contact_name: "משה",
    contact_phone: "050-9999999",
    status: "approved",
  });
  await insertOne(site, "procurement_order_lines", { order_id: order.id, internal_item_id: item.id, supplier_id: supplier.id, quantity: 3 });
  const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const storagePath = `purchase-orders/${order.id}/v1/order-test.pdf`;
  const up = await buyer.storage.from("purchase-order-attachments").upload(storagePath, pdfBytes, { contentType: "application/pdf" });
  check("order PDF uploaded", !up.error, up.error);
  mailsBefore = mails.length;
  const proc = await invoke(buyer, "procurement-send", {
    action: "send_order",
    orderId: order.id,
    eventType: "order_created",
    orderVersion: 1,
    pdfs: [{ supplierId: supplier.id, fileName: `הזמנה ${order.order_number}.pdf`, storagePath }],
    finalStatus: "sent_to_supplier",
  });
  const pm = mails[mailsBefore];
  check("procurement-send answered success", proc.status === 200 && proc.data?.success, proc);
  check("email To = all supplier addresses", pm && mailTo(pm).sort().join() === "orders@supplier.example,supplier@example.com", pm && mailTo(pm));
  check("subject is the purchase order", pm?.subject?.startsWith(`הזמנת רכש ${order.order_number} – `), pm?.subject);
  const pdf = pm?.attachments.find((a) => a.contentType === "application/pdf");
  check("PDF attached with the Hebrew file name", pdf?.filename === `הזמנה ${order.order_number}.pdf` && pdf.content.equals(pdfBytes), pdf?.filename);
  check("HTML has delivery site and download link", String(pm?.html).includes("מחסן ראשי") && String(pm?.html).includes("/storage/v1/object/sign/purchase-order-attachments/"));
  const { data: po } = await site.from("procurement_orders").select("status").eq("id", order.id).single();
  const { data: acts } = await site.from("procurement_order_activity").select("action").eq("order_id", order.id);
  check("order marked sent_to_supplier + email_sent activity", po?.status === "sent_to_supplier" && acts?.some((a) => a.action === "email_sent"), { po, acts });

  console.log("Other senders");
  const sentTo = (from: number) => waCalls.slice(from).map((c) => c.body.chatId);
  if (!isSaturdayIL) {
    before = waCalls.length;
    const im = await invoke(ops, "internal-message-whatsapp", {
      record: { recipient_id: workerId, sender_id: adminId, subject: "בדיקה", body: "הודעה פנימית לבדיקה" },
    });
    check("internal-message-whatsapp -> recipient", im.data?.status === 200 && waCalls.at(-1)?.body.message?.includes("הודעה פנימית לבדיקה") && sentTo(before).join() === "972501234567@c.us", { im, to: sentTo(before) });

    before = waCalls.length;
    const dup = await insertOne(ops, "tasks", { branch_id: branch.id, work_type: "ניקוי ויטרינות", assigned_to: workerId });
    const tcw = await invoke(ops, "task-created-webhook", { type: "INSERT", source: "task", record: dup });
    const { data: dupLog } = await ops.from("whatsapp_log").select("webhook_status").eq("task_id", dup.id).eq("message_type", "duplicate_alert");
    check("task-created-webhook: duplicate alert to אורית + task message", tcw.data?.success && sentTo(before).includes("972503771149@c.us") && sentTo(before).includes("972501234567@c.us") && dupLog?.[0]?.webhook_status === 200, { tcw, to: sentTo(before), dupLog });
  }

  const viewedQuote = await insertOne(ops, "quotes", { network_name_snapshot: "רשת בדיקה", notification_email: "manager@example.com", created_by: adminId });
  mailsBefore = mails.length;
  const viewed = await invoke(createClient(`${API}/api/ops`, "public", opts), "quote-viewed", { quoteId: viewedQuote.id });
  check("quote-viewed -> email to the quote's manager", viewed.data?.ok && mails.length === mailsBefore + 1 && mailTo(mails.at(-1)!).join() === "manager@example.com" && mails.at(-1)!.subject?.includes("נצפתה"), { viewed, subject: mails.at(-1)?.subject });

  mailsBefore = mails.length;
  const contact = await invoke(createClient(`${API}/api/site`, "public", opts), "contact-form", {
    name: "גולש בדיקה", phone: "050-1112233", email: "visitor@example.com", message: "אשמח להצעת מחיר",
  });
  const cm = mails.at(-1);
  check("contact-form -> office, reply-to the visitor", contact.data?.ok && mails.length === mailsBefore + 1 && mailTo(cm!).join() === "maya@yaroknet.co.il" && cm!.replyTo?.value[0]?.address === "visitor@example.com" && String(cm!.html).includes("אשמח להצעת מחיר"), { contact, to: cm && mailTo(cm) });

  const reportPath = `task_reports/test-${Date.now()}.pdf`;
  await admin.storage.from("field-media").upload(reportPath, pdfBytes, { contentType: "application/pdf" });
  mailsBefore = mails.length;
  const report = await invoke(admin, "send-task-report", { taskIds: [task.id], pdfPath: reportPath, recipientEmail: "client@example.com" });
  const rm = mails.at(-1);
  check("send-task-report -> client with PDF attached", report.data?.ok && mails.length === mailsBefore + 1 && mailTo(rm!).join() === "client@example.com" && rm!.attachments.some((a) => a.filename === "task-report.pdf") && String(rm!.html).includes("סניף מרכז"), { report, subject: rm?.subject });

  const vehicle = await insertOne(site, "fleet_vehicles", { license_plate: "12-345-67", make: "טויוטה", model: "קורולה", status: "active" });
  const driver = await insertOne(site, "fleet_drivers", { full_name: "נהג בדיקה", phone: "054-765-4321" });
  await insertOne(site, "fleet_driver_assignments", { vehicle_id: vehicle.id, driver_id: driver.id, start_date: "2026-01-01" });
  before = waCalls.length;
  const kmRes = await fetch(`${API}/api/site/functions/v1/fleet-km-cron?force=1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey()}`, "x-cron-secret": cronSecretValue(), "Content-Type": "application/json" },
    body: "{}",
  });
  const km = await kmRes.json();
  const { data: kmEvents } = await site.from("fleet_n8n_events").select("status,driver_phone,payload").eq("event_type", "km_request");
  check("fleet-km-cron -> km request WhatsApp to the driver, event marked sent", km.ok && sentTo(before).join() === "972547654321@c.us" && waCalls.at(-1)?.body.message?.includes("/km-report/") && kmEvents?.[0]?.status === "sent", { km, to: sentTo(before), kmEvents });
  before = waCalls.length;
  await fetch(`${API}/api/site/functions/v1/fleet-km-cron?force=1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey()}`, "x-cron-secret": cronSecretValue(), "Content-Type": "application/json" },
    body: "{}",
  });
  check("fleet-km-cron re-run does not resend the same request", waCalls.length === before, sentTo(before));

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const pad = (n: number) => String(n).padStart(2, "0");
  await site.from("fleet_vehicles").update({ test_expiry_date: `${in30.getFullYear()}-${pad(in30.getMonth() + 1)}-${pad(in30.getDate())}` }).eq("id", vehicle.id);
  await site.from("profiles").update({ phone: "052-999-8888" }).eq("user_id", buyerId);
  before = waCalls.length;
  const alertsRes = await fetch(`${API}/api/site/functions/v1/fleet-alerts-cron`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey()}`, "x-cron-secret": cronSecretValue(), "Content-Type": "application/json" },
    body: "{}",
  });
  const alerts = await alertsRes.json();
  const { data: alertRows } = await site.from("fleet_alerts").select("status,alert_type").eq("vehicle_id", vehicle.id);
  check(
    // both super admins (one login for the whole platform) + the driver
    "fleet-alerts-cron: test-expiry WhatsApp to admins + driver, alert marked sent",
    alerts.ok && sentTo(before).sort().join() === "972521112222@c.us,972529998888@c.us,972547654321@c.us" && alertRows?.[0]?.status === "sent",
    { alerts, to: sentTo(before), alertRows },
  );

  mailsBefore = mails.length;
  await insertOne(site, "machines", { machine_name: "מכונת שטיפה 7", current_location: "מחסן", current_status: "פעיל" });
  await new Promise((r) => setTimeout(r, 800));
  const mm = mails.at(-1);
  check("new machine -> email to the machines recipients", mails.length === mailsBefore + 1 && mailTo(mm!).sort().join() === "office@yaroknet.co.il,rotem@yaroknet.co.il" && mm!.subject?.includes("מכונת שטיפה 7"), mm && { to: mailTo(mm), subject: mm.subject });

  for (const fn of [
    "custom-reminder-runner", "dafna-monthly-reminder", "pini-monthly-reminder", "personal-task-reminder",
    "service-form-reminder", "whatsapp-daily-ilan", "whatsapp-weekly-ilan", "whatsapp-shaina-vitrines", "whatsapp-scheduler",
  ]) {
    const r = await invoke(ops, fn, {});
    check(`${fn} runs without error`, r.status === 200 && !r.data?.error, r);
  }
  const { data: badLogs } = await ops.from("whatsapp_log").select("message_type,webhook_status").neq("webhook_status", 200);
  check("every whatsapp_log row has the real send status (only the deliberate failure is not 200)", badLogs?.length === 1 && badLogs[0].webhook_status === 500, badLogs);

  await stopBackend();

  console.log("Dry-run mode (default)");
  const waBefore = waCalls.length;
  const mailBefore = mails.length;
  await startBackend({ ...messagingEnv, MESSAGING_DRY_RUN: undefined, WEBHOOK_DRY_RUN: undefined, WHATSAPP_DRY_RUN: undefined });
  check("backend reports dry-run mode", backendLog.includes("[messaging] dry-run mode"), backendLog.slice(0, 600));
  const dryTask = await insertOne(ops, "tasks", { branch_id: branch.id, work_type: "ניקוי ויטרינות", assigned_to: workerId });
  const dryNotify = await invoke(ops, "whatsapp-notify", { type: "new", task: dryTask });
  if (!isSaturdayIL) {
    const { data: dryLog } = await ops.from("whatsapp_log").select("webhook_status").eq("task_id", dryTask.id);
    check("dry-run WhatsApp reported as sent (status 200 logged)", dryNotify.data?.recipients?.[0]?.status === 200 && dryLog?.[0]?.webhook_status === 200, { dryNotify, dryLog });
    check("dry-run WhatsApp printed in the log", backendLog.includes("DRY RUN — WhatsApp to 972501234567@c.us not sent"), backendLog.slice(-1500));
  }
  const quote3 = await insertOne(ops, "quotes", { network_name_snapshot: "רשת בדיקה", contact_email: "client@example.com", created_by: adminId });
  const admin2 = await signedIn("ops", "msgtest-admin@yarok.local");
  const dryQuote = await invoke(admin2, "send-quote", { quoteId: quote3.id });
  const { data: q3 } = await ops.from("quotes").select("status").eq("id", quote3.id).single();
  check("dry-run email: flow continues (quote marked sent)", dryQuote.status === 200 && q3?.status === "sent", { dryQuote, q3 });
  check("dry-run email printed in the log", backendLog.includes("DRY RUN — email not sent") && backendLog.includes("To: client@example.com"));
  check("mock Green API not called in dry-run", waCalls.length === waBefore, waCalls.slice(waBefore));
  check("mock SMTP not called in dry-run", mails.length === mailBefore, mails.slice(mailBefore).map((m) => m.subject));
  await stopBackend();
}

main()
  .catch((err) => {
    failures++;
    console.error(err);
    if (backendLog) console.error(`--- backend log ---\n${backendLog.slice(-4000)}`);
  })
  .finally(async () => {
    await stopBackend().catch(() => {});
    await dropTestDb().catch(() => {});
    green.close();
    smtp.close(() => {});
    console.log(failures ? `\n${failures} check(s) failed` : "\nAll messaging checks passed");
    process.exit(failures ? 1 : 0);
  });
