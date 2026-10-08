/**
 * End-to-end check of the local backend using the same supabase-js client the app uses.
 *   npm run test:api -- --email <admin email> --password <admin password>
 * Creates temporary records/users and removes them afterwards.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
import "../config.ts";
import { opsProject } from "../projects/ops/index.ts";
import { siteProject } from "../projects/site/index.ts";

const { values } = parseArgs({ options: { email: { type: "string" }, password: { type: "string" } } });
if (!values.email || !values.password) {
  console.error("Usage: npm run test:api -- --email <admin email> --password <admin password>");
  process.exit(1);
}

const url = opsProject.apiUrl;
const anonKey = opsProject.anonKey;
const newClient = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(url, opsProject.serviceRoleKey, { auth: { persistSession: false } });
const siteService = createClient(siteProject.apiUrl, siteProject.serviceRoleKey, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail ?? "");
  }
}

const tag = `smoke-${Date.now()}`;
const cleanup: (() => Promise<unknown>)[] = [];

async function main() {
  console.log("Auth");
  const admin = newClient();
  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email: values.email!,
    password: values.password!,
  });
  check("admin signs in with email", signIn.session && !signInErr, signInErr);
  const adminId = signIn.user!.id;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", adminId);
  check("admin roles readable", roles?.some((r) => r.role === "super_admin"), roles);
  const bad = await newClient().auth.signInWithPassword({ email: values.email!, password: "wrong-password" });
  check("wrong password rejected", bad.error?.message === "Invalid login credentials", bad.error);

  console.log("Database");
  const { data: network, error: nErr } = await admin.from("networks").insert({ name: `${tag} רשת` }).select("id").single();
  check("insert network .select().single()", network?.id && !nErr, nErr);
  cleanup.push(() => admin.from("networks").delete().eq("id", network!.id));
  const { data: branch } = await admin
    .from("branches")
    .insert({ name: `${tag} סניף`, network_id: network!.id, city: "תל אביב" })
    .select("id")
    .single();
  const { data: task, error: tErr } = await admin
    .from("tasks")
    .insert({ branch_id: branch!.id, work_type: "ניקוי ויטרינות", frequency: "monthly", due_date: "2026-10-01" })
    .select()
    .single();
  check("insert task with defaults", task?.status === "pending" && task?.sides_required === 1 && !tErr, tErr ?? task);

  const { data: joined, error: jErr } = await admin
    .from("tasks")
    .select("*, branches(id, name, city, network_id, networks(id, name))")
    .eq("id", task!.id)
    .order("created_at", { ascending: false });
  check(
    "nested embed branches → networks",
    joined?.[0]?.branches?.networks?.name === `${tag} רשת` && !jErr,
    jErr ?? joined,
  );

  const { data: filtered } = await admin
    .from("tasks")
    .select("id")
    .eq("branch_id", branch!.id)
    .not("status", "in", "(completed,cancelled)")
    .ilike("work_type", "%ויטרינ%")
    .gte("due_date", "2026-09-01");
  check("not.in / ilike / gte filters", filtered?.length === 1, filtered);

  const { data: none } = await admin.from("tasks").select("id").eq("branch_id", branch!.id).is("assigned_to", null).neq("status", "pending");
  check("is null + neq", none?.length === 0, none);

  const single0 = await admin.from("tasks").select("id").eq("id", "00000000-0000-0000-0000-000000000000").single();
  check("single() with no rows -> PGRST116", single0.error?.code === "PGRST116", single0.error);
  const maybe0 = await admin.from("tasks").select("id").eq("id", "00000000-0000-0000-0000-000000000000").maybeSingle();
  check("maybeSingle() with no rows -> null", maybe0.data === null && !maybe0.error, maybe0);

  const up1 = await admin.from("whatsapp_backlog").upsert({ id: tag, done: true, note: "a" }, { onConflict: "id" });
  const up2 = await admin.from("whatsapp_backlog").upsert({ id: tag, done: false, note: "b" }, { onConflict: "id" });
  const { data: backlog } = await admin.from("whatsapp_backlog").select("id, done, note").eq("id", tag);
  check("upsert merge-duplicates", !up1.error && !up2.error && backlog?.[0]?.note === "b" && backlog.length === 1, backlog);
  cleanup.push(() => admin.from("whatsapp_backlog").delete().eq("id", tag));

  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .insert({ network_name_snapshot: tag, created_by: adminId, status: "sent" })
    .select("id, quote_number, unique_token")
    .single();
  check("quote number sequence + token default", quote && quote.quote_number >= 1000 && quote.unique_token?.length === 48, qErr ?? quote);
  cleanup.push(() => admin.from("quotes").delete().eq("id", quote!.id));

  const dup = await admin.from("user_roles").insert({ user_id: adminId, role: "super_admin" });
  check("unique violation -> 23505", dup.error?.code === "23505", dup.error);

  const noWhere = await admin.from("tasks").delete().neq("id", "x").is("id", null);
  check("filtered delete allowed", !noWhere.error, noWhere.error);

  console.log("Edge functions");
  const phone = `05${String(Date.now()).slice(-8)}`;
  const tlEmail = `${tag}@yarok.local`;
  const created = await admin.functions.invoke("create-user", {
    body: { email: tlEmail, password: "Leader123!", full_name: `${tag} ראש צוות`, phone, role: "team_leader" },
  });
  check("create-user function", created.data?.success && !created.error, created.error ?? created.data);
  const tlId = created.data?.user_id as string;
  cleanup.push(() => service.auth.admin.deleteUser(tlId));

  const resolved = await newClient().functions.invoke("login-with-phone", { body: { phone, password: "Leader123!" } });
  check("login-with-phone resolves email", resolved.data?.ok && resolved.data?.email === tlEmail, resolved.data);

  const reset = await admin.functions.invoke("update-password", { body: { email: tlEmail, password: "Leader456!" } });
  check("update-password function", reset.data?.ok, reset.data);

  const leader = newClient();
  const tlLogin = await leader.auth.signInWithPassword({ email: tlEmail, password: "Leader456!" });
  check("team leader signs in with new password", !!tlLogin.data.session, tlLogin.error);

  console.log("Entry from the portal's 360 button");
  const adminEnter = await admin.rpc("can_enter_yarok360");
  check("super admin may enter 360", adminEnter.data === true, adminEnter);
  const leaderEnter = await leader.rpc("can_enter_yarok360");
  check("new team leader without the 360 module may not enter", leaderEnter.data === false, leaderEnter);
  const omEmail = `${tag}-om@yarok.local`;
  const om = await admin.functions.invoke("create-user", {
    body: { email: omEmail, password: "Office123!", full_name: `${tag} מנהל משרד`, role: "office_manager" },
  });
  const omId = om.data?.user_id as string;
  cleanup.push(() => service.auth.admin.deleteUser(omId));
  const office = newClient();
  await office.auth.signInWithPassword({ email: omEmail, password: "Office123!" });
  const omBefore = await office.rpc("can_enter_yarok360");
  check("office manager without the 360 module may not enter", omBefore.data === false, omBefore);
  const { data: mod360 } = await siteService.from("modules").select("id").eq("name", "yarok360").single();
  const grant = await siteService.from("user_module_permissions").insert({ user_id: omId, module_id: mod360?.id, has_access: true });
  cleanup.push(() => siteService.from("user_module_permissions").delete().eq("user_id", omId));
  const omAfter = await office.rpc("can_enter_yarok360");
  check("office manager with the 360 module may enter", !grant.error && omAfter.data === true, grant.error ?? omAfter);

  console.log("Row level security");
  const before = await leader.from("tasks").select("id").eq("id", task!.id);
  check("team leader cannot see unassigned task", before.data?.length === 0, before.data);
  await admin.from("tasks").update({ assigned_to: tlId }).eq("id", task!.id);
  const after = await leader.from("tasks").select("id, branches(name, networks(name))").eq("id", task!.id);
  check("team leader sees assigned task + embeds", after.data?.[0]?.branches?.networks?.name === `${tag} רשת`, after);
  const tlNetworks = await leader.from("networks").select("id").eq("id", network!.id);
  check("team leader sees network via task", tlNetworks.data?.length === 1, tlNetworks.data);
  const tlInsert = await leader.from("networks").insert({ name: "nope" });
  check("team leader cannot insert network (42501)", tlInsert.error?.code === "42501", tlInsert.error);
  const tlServices = await leader.from("services").select("id");
  check("team leader sees no services (admin-only)", tlServices.data?.length === 0, tlServices);

  const anon = newClient();
  const publicQuote = await anon.from("quotes").select("id, quote_number").eq("unique_token", quote!.unique_token).maybeSingle();
  check("anon reads quote by token", publicQuote.data?.id === quote!.id, publicQuote);
  const viewLog = await anon.from("quote_view_log").insert({ quote_id: quote!.id, user_agent: "smoke" });
  check("anon inserts quote_view_log", !viewLog.error, viewLog.error);
  const anonTasks = await anon.from("tasks").select("id");
  check("anon sees no tasks", anonTasks.data?.length === 0, anonTasks);

  console.log("Storage");
  const path = `${tlId}/${tag}.txt`;
  const up = await leader.storage.from("field-media").upload(path, new Blob(["hello yarok"], { type: "text/plain" }));
  check("team leader uploads to field-media", !up.error, up.error);
  const signed = await leader.storage.from("field-media").createSignedUrl(path, 60);
  const signedBody = signed.data ? await (await fetch(signed.data.signedUrl)).text() : null;
  check("signed URL serves file", signedBody === "hello yarok", signed.error ?? signedBody);
  const pub = leader.storage.from("field-media").getPublicUrl(path);
  const pubRes = await fetch(pub.data.publicUrl);
  check("public URL serves file", pubRes.ok && (await pubRes.text()) === "hello yarok", pub.data.publicUrl);
  const dupUpload = await leader.storage.from("field-media").upload(path, new Blob(["x"]));
  check("duplicate upload rejected without upsert", !!dupUpload.error, dupUpload);
  cleanup.push(() => service.storage.from("field-media").remove([path]));

  console.log("Realtime");
  const received = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000);
    const channel = admin
      .channel(`smoke-${tag}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_messages" }, (payload) => {
        if ((payload.new as any)?.subject === tag) {
          clearTimeout(timer);
          admin.removeChannel(channel);
          resolve(true);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await leader.from("internal_messages").insert({ sender_id: tlId, recipient_id: adminId, subject: tag, body: "שלום" });
        }
      });
  });
  check("postgres_changes delivered to subscriber", await received);
  const { count } = await admin
    .from("internal_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", adminId)
    .eq("subject", tag);
  check("count exact + head", count === 1, count);
  cleanup.push(() => service.from("internal_messages").delete().eq("subject", tag));

  console.log("WhatsApp (dry run)");
  const notify = await admin.functions.invoke("whatsapp-notify", { body: { type: "new", task: { ...task, assigned_to: tlId } } });
  check("whatsapp-notify runs", notify.data?.success, notify.data ?? notify.error);
  const { data: log } = await admin.from("whatsapp_log").select("id, message_type").eq("task_id", task!.id);
  check("whatsapp_log row written", (log?.length ?? 0) >= 1, log);
  const { data: saved } = await admin.from("tasks").select("whatsapp_message").eq("id", task!.id).single();
  check("task.whatsapp_message saved", !!saved?.whatsapp_message, saved);

  console.log("Cascade delete");
  await admin.from("networks").delete().eq("id", network!.id);
  cleanup.shift();
  const orphanBranch = await service.from("branches").select("id").eq("id", branch!.id);
  const orphanTask = await service.from("tasks").select("id").eq("id", task!.id);
  const orphanLog = await service.from("whatsapp_log").select("task_id").eq("id", log?.[0]?.id ?? "");
  check("branches + tasks cascaded", orphanBranch.data?.length === 0 && orphanTask.data?.length === 0);
  check("whatsapp_log.task_id set null", orphanLog.data?.[0]?.task_id === null, orphanLog.data);
  await service.from("whatsapp_log").delete().eq("recipient_phone", phone);
}

try {
  await main();
} catch (err) {
  failures++;
  console.error("Smoke test crashed:", err);
} finally {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch(() => {});
}
console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
