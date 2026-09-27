/**
 * End-to-end check of the website's backend (/api/site) using the site's own supabase-js version.
 *   npm run test:site -- --email <super admin email> --password <password>
 * Creates temporary records/users and removes them afterwards.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { config } from "../config.ts";
import { siteProject } from "../projects/site/index.ts";

const require = createRequire(path.join(config.root, "site", "package.json"));
const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");

const { values } = parseArgs({ options: { email: { type: "string" }, password: { type: "string" } } });
if (!values.email || !values.password) {
  console.error("Usage: npm run test:site -- --email <super admin email> --password <password>");
  process.exit(1);
}

const url = siteProject.apiUrl;
const newClient = () => createClient(url, siteProject.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(url, siteProject.serviceRoleKey, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail ?? "");
  }
}

const tag = `smoke-${Date.now()}`;
const cleanup: (() => PromiseLike<unknown>)[] = [];
const year = new Date().getFullYear();

async function main() {
  console.log("Auth + portal");
  const admin = newClient();
  const login = await admin.auth.signInWithPassword({ email: values.email!, password: values.password! });
  check("super admin signs in", !!login.data.session, login.error);
  const adminId = login.data.user!.id;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", adminId);
  check("roles readable", roles?.some((r) => r.role === "super_admin"), roles);
  const { data: modules } = await admin.from("modules").select("name, route").eq("is_active", true).order("sort_order");
  check("portal modules seeded (field_journal inactive)", modules?.length === 7 && !modules.some((m) => m.name === "field_journal"), modules);
  const { data: profile } = await admin.from("profiles").select("full_name, procurement_token").eq("user_id", adminId).single();
  check("profile created by handle_new_user", !!profile?.full_name, profile);

  console.log("Public website (anonymous visitor)");
  const anon = newClient();
  const inquiry = await anon.from("contact_inquiries").insert({ full_name: tag, email: "a@b.co", message: "שלום" });
  check("contact form submits", !inquiry.error, inquiry.error);
  cleanup.push(() => service.from("contact_inquiries").delete().eq("full_name", tag));
  const anonRead = await anon.from("contact_inquiries").select("id").eq("full_name", tag);
  check("anon cannot read inquiries", anonRead.data?.length === 0, anonRead);
  const templates = await anon.from("public_survey_templates").select("id, name, question_1");
  check("public survey template view", templates.data?.length === 1 && !!templates.data[0].question_1, templates);
  const survey = {
    chain_name: tag,
    branch_name: "סניף",
    manager_name: "מנהל",
    customer_phone: "050-1234567",
    rating_cleanliness: 5,
    rating_punctuality: 4,
    rating_manager_service: 5,
    rating_issue_handling: 3,
    rating_overall: 5,
    template_id: templates.data?.[0]?.id,
  };
  const okSurvey = await anon.from("customer_surveys").insert(survey);
  check("valid survey accepted", !okSurvey.error, okSurvey.error);
  const badSurvey = await anon.from("customer_surveys").insert({ ...survey, rating_overall: 9 });
  check("invalid survey rejected by policy", badSurvey.error?.code === "42501", badSurvey.error);
  cleanup.push(() => service.from("customer_surveys").delete().eq("chain_name", tag));
  const prices = await anon.from("public_price_list").select("*");
  check("public price list view", !prices.error && Array.isArray(prices.data), prices.error);

  console.log("Triggers + numbering");
  const { data: proposal, error: pErr } = await admin
    .from("proposals")
    .insert({ client_name: tag, contact_person: "x", contact_email: "x@y.co", service_type: "ניקיון", location: "ת״א", price: 100, created_by: adminId })
    .select("id, proposal_number")
    .single();
  check("proposal number YRK-xxxxx", /^YRK-\d{5}$/.test(proposal?.proposal_number ?? ""), pErr ?? proposal);
  cleanup.push(() => service.from("proposals").delete().eq("id", proposal!.id));
  const { data: order, error: oErr } = await admin.from("procurement_orders").insert({ created_by: adminId }).select("id, order_number").single();
  check("procurement order ORD-YYYY-xxxxx", new RegExp(`^ORD-${year}-\\d{5}$`).test(order?.order_number ?? ""), oErr ?? order);
  cleanup.push(() => service.from("procurement_orders").delete().eq("id", order!.id));
  const { data: po, error: poErr } = await admin
    .from("purchase_orders")
    .insert({ supplier_name: tag, department: "תפעול", created_by: adminId })
    .select("id, order_number")
    .single();
  check("purchase order PO-YYYY-xxxxx", new RegExp(`^PO-${year}-\\d{5}$`).test(po?.order_number ?? ""), poErr ?? po);
  cleanup.push(() => service.from("purchase_orders").delete().eq("id", po!.id));
  const eq = await admin.rpc("generate_equipment_order_number");
  check("rpc generate_equipment_order_number", /^EQ-\d{5}$/.test(String(eq.data)), eq);

  console.log("Fleet");
  const { data: driver } = await admin.from("fleet_drivers").insert({ full_name: `${tag} נהג` }).select("id").single();
  const { data: vehicle, error: vErr } = await admin
    .from("fleet_vehicles")
    .insert({ license_plate: tag, leasing_start_date: "2026-01-31", leasing_months: 1, current_km: 1000 })
    .select("id, leasing_end_date")
    .single();
  check("leasing end date calculated", vehicle?.leasing_end_date === "2026-02-28", vErr ?? vehicle);
  cleanup.push(() => service.from("fleet_drivers").delete().eq("id", driver!.id));
  cleanup.push(() => service.from("fleet_vehicles").delete().eq("id", vehicle!.id));
  await admin.from("fleet_km_readings").insert({ vehicle_id: vehicle!.id, reading_km: 1500 });
  const { data: afterKm } = await admin.from("fleet_vehicles").select("current_km").eq("id", vehicle!.id).single();
  check("km reading updates current_km", afterKm?.current_km === 1500, afterKm);
  await admin.from("fleet_driver_assignments").insert({ vehicle_id: vehicle!.id, driver_id: driver!.id, start_date: "2026-01-01" });
  const second = await admin.from("fleet_driver_assignments").insert({ vehicle_id: vehicle!.id, driver_id: driver!.id, start_date: "2026-02-01" });
  check("one active assignment per vehicle (partial unique)", second.error?.code === "23505", second.error);
  const { data: fine } = await admin
    .from("fleet_fines")
    .insert({ vehicle_id: vehicle!.id, fine_date: "2026-03-10", amount: 250 })
    .select("driver_id")
    .single();
  check("fine auto-attributed to driver", fine?.driver_id === driver!.id, fine);
  const blocked = await admin.from("fleet_drivers").delete().eq("id", driver!.id);
  check("driver with assignment can't be deleted (FK 23503)", blocked.error?.code === "23503", blocked.error);
  const atDate = await admin.rpc("fleet_driver_at_date", { _vehicle_id: vehicle!.id, _date: "2026-04-01" });
  check("rpc fleet_driver_at_date", atDate.data === driver!.id, atDate);
  cleanup.unshift(() => service.from("fleet_driver_assignments").delete().eq("vehicle_id", vehicle!.id));

  console.log("Users, roles, permissions");
  const mgrEmail = `${tag}@yarok.local`;
  const created = await admin.functions.invoke("create-user", {
    body: { action: "create", email: mgrEmail, password: "Manager123!", full_name: `${tag} מנהל`, role: "manager" },
  });
  check("create-user function (manager)", !created.error && created.data?.success !== false, created.error ?? created.data);
  const mgrId = (created.data?.user?.id ?? created.data?.user_id) as string | undefined;
  if (mgrId) cleanup.push(() => service.auth.admin.deleteUser(mgrId));
  const manager = newClient();
  const mgrLogin = await manager.auth.signInWithPassword({ email: mgrEmail, password: "Manager123!" });
  check("manager signs in", !!mgrLogin.data.session, mgrLogin.error);
  const { data: complaint, error: cErr } = await manager
    .from("complaints")
    .insert({
      customer_name: tag,
      customer_phone: "0501112233",
      branch_name: "סניף",
      city: "חיפה",
      manager_id: mgrLogin.data.user?.id,
      manager_name: "מנהל",
      complaint_description: "בדיקה",
      incident_date: new Date().toISOString().slice(0, 10),
      created_by: mgrLogin.data.user?.id,
    })
    .select("id")
    .single();
  check("manager creates complaint", !!complaint && !cErr, cErr);
  cleanup.push(() => service.from("complaints").delete().eq("customer_name", tag));
  const count = await manager.rpc("get_customer_complaint_count", { phone: "0501112233" });
  check("rpc get_customer_complaint_count", count.data === 1, count);
  const mgrDeletePo = await manager.from("purchase_orders").delete().eq("id", po!.id).select();
  check("manager cannot delete purchase orders (super admin only)", mgrDeletePo.data?.length === 0, mgrDeletePo);
  const mgrSettings = await manager.from("system_settings").update({ description: "x" }).eq("setting_key", "reminder_warning_km").select();
  check("manager cannot change system settings", mgrSettings.data?.length === 0, mgrSettings);

  console.log("Storage");
  const logoPath = `${tag}.txt`;
  const up = await admin.storage.from("client-logos").upload(logoPath, new Blob(["logo"], { type: "text/plain" }));
  check("admin uploads client logo", !up.error, up.error);
  const pub = admin.storage.from("client-logos").getPublicUrl(logoPath);
  check("public logo URL serves file", (await (await fetch(pub.data.publicUrl)).text()) === "logo", pub.data.publicUrl);
  const anonUp = await anon.storage.from("client-logos").upload(`${tag}-anon.txt`, new Blob(["x"]));
  check("anon cannot upload logos", !!anonUp.error, anonUp);
  const priv = await admin.storage.from("fleet-files").upload(`${tag}/doc.txt`, new Blob(["secret"], { type: "text/plain" }));
  const privPublic = await fetch(admin.storage.from("fleet-files").getPublicUrl(`${tag}/doc.txt`).data.publicUrl);
  check("private bucket not publicly readable", !priv.error && !privPublic.ok, priv.error ?? privPublic.status);
  const signed = await admin.storage.from("fleet-files").createSignedUrl(`${tag}/doc.txt`, 60);
  check("signed URL for private file", signed.data && (await (await fetch(signed.data.signedUrl)).text()) === "secret", signed.error);
  cleanup.push(() => service.storage.from("client-logos").remove([logoPath]));
  cleanup.push(() => service.storage.from("fleet-files").remove([`${tag}/doc.txt`]));

  console.log("Realtime (protocol v1)");
  const received = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000);
    const channel = manager
      .channel(`smoke-${tag}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        if ((payload.new as { title?: string })?.title === tag) {
          clearTimeout(timer);
          manager.removeChannel(channel);
          resolve(true);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await admin.from("notifications").insert({ title: tag, body: "בדיקה", created_by: adminId, target_type: "all" });
        }
      });
  });
  check("notification INSERT delivered", await received);
  cleanup.push(() => service.from("notifications").delete().eq("title", tag));
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
