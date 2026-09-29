// Smart Documents for the fleet module.
//   POST { action: "analyze", document_id }        → OCR/extract via Google Gemini, save extracted_data
//   POST { action: "apply",   document_id, data }  → apply extracted (possibly edited) data to fleet_*
//   POST { action: "ignore",  document_id }        → mark ignored
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Google AI Studio key (free tier covers gemini-2.5-flash)
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const AI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type DocRow = {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  doc_type: string;
  file_url: string | null;
  title: string;
};

const j = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/* --------------------------- prompt templates --------------------------- */

function schemaFor(docType: string): { instructions: string; fields: string[] } {
  const t = (docType || "").trim();
  if (t.includes("רישיון נהיגה")) {
    return {
      fields: ["full_name", "id_number", "license_number", "license_expiry"],
      instructions:
        `זהו צילום של רישיון נהיגה ישראלי. חלץ בדיוק את השדות הבאים אם קיימים:
- full_name: שם מלא של בעל הרישיון
- id_number: מספר תעודת זהות (9 ספרות)
- license_number: מספר רישיון נהיגה
- license_expiry: תאריך תוקף בפורמט YYYY-MM-DD`,
    };
  }
  if (t.includes("רישיון רכב")) {
    return {
      fields: ["license_plate", "make", "model", "year", "vin", "test_expiry_date"],
      instructions:
        `זהו רישיון רכב ישראלי. חלץ:
- license_plate: מספר רכב (ספרות בלבד ללא מקפים)
- make: יצרן
- model: דגם
- year: שנת ייצור (מספר)
- vin: מספר שלדה
- test_expiry_date: תאריך טסט הבא בפורמט YYYY-MM-DD`,
    };
  }
  if (t.includes("ביטוח")) {
    return {
      fields: ["license_plate", "insurance_company", "policy_number", "insurance_start_date", "insurance_expiry_date"],
      instructions:
        `זו תעודת ביטוח רכב (חובה או מקיף). חלץ:
- license_plate: מספר רכב
- insurance_company: שם חברת הביטוח
- policy_number: מספר פוליסה
- insurance_start_date: תאריך תחילת הביטוח YYYY-MM-DD
- insurance_expiry_date: תאריך סיום הביטוח YYYY-MM-DD`,
    };
  }
  return {
    fields: ["summary"],
    instructions: `סוג המסמך: "${t || "לא ידוע"}". סכם בקצרה את תוכנו בשדה summary. אין לחלץ נתונים מובנים.`,
  };
}

/* --------------------------- helpers --------------------------- */

function extToMime(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".pdf")) return "application/pdf";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

async function toBase64(url: string): Promise<{ b64: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch file failed: ${res.status}`);
  const mime = res.headers.get("content-type")?.split(";")[0] || extToMime(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  // base64 encode in chunks to avoid stack overflow
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) s += String.fromCharCode(...buf.subarray(i, i + chunk));
  return { b64: btoa(s), mime };
}

function tryParseJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { /* try to find first {...} */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
  return null;
}

async function runExtraction(doc: DocRow): Promise<any> {
  if (!doc.file_url) throw new Error("no file to analyze");
  const spec = schemaFor(doc.doc_type);
  const { b64, mime } = await toBase64(doc.file_url);

  const system =
    "אתה עוזר לחילוץ נתונים ממסמכי צי רכב בישראל. ענה תמיד ב-JSON חוקי בלבד ללא טקסט מסביב. אם שדה לא זוהה בוודאות – השאר null. תאריכים תמיד בפורמט YYYY-MM-DD.";
  const user =
    `${spec.instructions}\n\nהחזר אובייקט JSON יחיד עם המפתחות: ${spec.fields.join(", ")}.\nללא הסברים, ללא markdown.`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: user }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  };

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY! },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${raw.slice(0, 400)}`);
  let payload: any;
  try { payload = JSON.parse(raw); } catch { throw new Error("Gemini returned non-JSON"); }
  const text: string = (payload?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("");
  const parsed = tryParseJson(text);
  if (!parsed || typeof parsed !== "object") throw new Error("could not parse extraction JSON");
  return parsed;
}

/* --------------------------- apply --------------------------- */

function cleanDate(s: unknown): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  // YYYY-MM-DD
  const m1 = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  // DD/MM/YYYY or DD.MM.YYYY
  const m2 = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m2) {
    const yy = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
    return `${yy}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  }
  return null;
}

function cleanPlate(s: unknown): string | null {
  if (!s || typeof s !== "string") return null;
  const digits = s.replace(/\D+/g, "");
  return digits.length >= 5 ? digits : null;
}

async function applyDriverLicense(supa: any, doc: DocRow, data: any): Promise<string> {
  const fullName = (data.full_name || "").toString().trim();
  const idNumber = (data.id_number || "").toString().replace(/\D+/g, "") || null;
  const licenseNumber = (data.license_number || "").toString().trim() || null;
  const licenseExpiry = cleanDate(data.license_expiry);
  if (!fullName && !idNumber && !licenseNumber) throw new Error("לא זוהה שם/ת.ז/רישיון נהיגה");

  // find existing driver: license_number match first, then by name
  let driverId: string | null = null;
  if (licenseNumber) {
    const { data: d1 } = await supa.from("fleet_drivers").select("id").eq("license_number", licenseNumber).maybeSingle();
    if (d1?.id) driverId = d1.id;
  }
  if (!driverId && fullName) {
    const { data: d2 } = await supa.from("fleet_drivers").select("id").eq("full_name", fullName).maybeSingle();
    if (d2?.id) driverId = d2.id;
  }

  const noteParts = idNumber ? [`ת.ז: ${idNumber}`] : [];
  const notesLine = noteParts.length ? noteParts.join(" · ") : null;

  if (driverId) {
    const patch: Record<string, unknown> = {};
    if (licenseNumber) patch.license_number = licenseNumber;
    if (licenseExpiry) patch.license_expiry = licenseExpiry;
    if (fullName) patch.full_name = fullName;
    if (notesLine) patch.notes = notesLine;
    if (Object.keys(patch).length) await supa.from("fleet_drivers").update(patch).eq("id", driverId);
  } else {
    const { data: created, error } = await supa.from("fleet_drivers").insert({
      full_name: fullName || "נהג ללא שם",
      license_number: licenseNumber,
      license_expiry: licenseExpiry,
      notes: notesLine,
      active: true,
    }).select("id").maybeSingle();
    if (error) throw error;
    driverId = created!.id;
  }

  // link to vehicle from the doc's folder
  if (doc.vehicle_id) {
    const today = new Date().toISOString().slice(0, 10);
    // close any open assignment for this vehicle to a different driver
    await supa
      .from("fleet_driver_assignments")
      .update({ end_date: today })
      .eq("vehicle_id", doc.vehicle_id)
      .is("end_date", null)
      .neq("driver_id", driverId);

    // if no open assignment for this pair, create one
    const { data: existing } = await supa
      .from("fleet_driver_assignments")
      .select("id")
      .eq("vehicle_id", doc.vehicle_id)
      .eq("driver_id", driverId)
      .is("end_date", null)
      .maybeSingle();
    if (!existing?.id) {
      await supa.from("fleet_driver_assignments").insert({
        vehicle_id: doc.vehicle_id,
        driver_id: driverId,
        start_date: today,
        reason: "זוהה ממסמך",
      });
    }
    // reflect on the vehicle row too
    await supa.from("fleet_vehicles").update({ driver_id: driverId }).eq("id", doc.vehicle_id);
    // and stamp the doc with driver_id
    await supa.from("fleet_documents").update({ driver_id: driverId }).eq("id", doc.id);
  }

  return `נהג ${fullName || ""} עודכן ושויך לרכב`;
}

async function applyVehicleLicense(supa: any, doc: DocRow, data: any): Promise<string> {
  if (!doc.vehicle_id) throw new Error("המסמך אינו משויך לרכב");
  const patch: Record<string, unknown> = {};
  if (data.make) patch.make = String(data.make).trim();
  if (data.model) patch.model = String(data.model).trim();
  if (data.year && !isNaN(Number(data.year))) patch.year = Number(data.year);
  if (data.vin) patch.vin = String(data.vin).trim();
  const testDate = cleanDate(data.test_expiry_date);
  if (testDate) patch.test_expiry_date = testDate;
  if (!Object.keys(patch).length) throw new Error("אין נתונים לעדכון");
  const { error } = await supa.from("fleet_vehicles").update(patch).eq("id", doc.vehicle_id);
  if (error) throw error;
  if (testDate) await supa.from("fleet_documents").update({ expiry_date: testDate }).eq("id", doc.id);
  return "רישיון הרכב עודכן";
}

async function applyInsurance(supa: any, doc: DocRow, data: any): Promise<string> {
  if (!doc.vehicle_id) throw new Error("המסמך אינו משויך לרכב");
  const patch: Record<string, unknown> = {};
  if (data.insurance_company) patch.insurance_company = String(data.insurance_company).trim();
  const end = cleanDate(data.insurance_expiry_date);
  if (end) patch.insurance_expiry_date = end;
  if (!Object.keys(patch).length) throw new Error("אין נתוני ביטוח לעדכון");
  const { error } = await supa.from("fleet_vehicles").update(patch).eq("id", doc.vehicle_id);
  if (error) throw error;
  if (end) await supa.from("fleet_documents").update({ expiry_date: end }).eq("id", doc.id);
  return "פרטי הביטוח עודכנו";
}

async function applyExtraction(supa: any, doc: DocRow, data: any): Promise<string> {
  const t = doc.doc_type || "";
  if (t.includes("רישיון נהיגה")) return applyDriverLicense(supa, doc, data);
  if (t.includes("רישיון רכב")) return applyVehicleLicense(supa, doc, data);
  if (t.includes("ביטוח")) return applyInsurance(supa, doc, data);
  throw new Error("סוג מסמך לא נתמך ליישום אוטומטי");
}

/* --------------------------- handler --------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "method not allowed" }, 405);

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const document_id = String(body?.document_id || "");
    if (!document_id) return j({ error: "missing document_id" }, 400);

    const { data: doc, error: e0 } = await supa
      .from("fleet_documents")
      .select("id, vehicle_id, driver_id, doc_type, file_url, title")
      .eq("id", document_id)
      .maybeSingle();
    if (e0) throw e0;
    if (!doc) return j({ error: "document not found" }, 404);

    if (action === "analyze") {
      if (!GEMINI_API_KEY) return j({ error: "סריקה אוטומטית לא הוגדרה (חסר GEMINI_API_KEY) – ניתן להזין את הנתונים ידנית" }, 200);
      await supa.from("fleet_documents").update({ analysis_status: "analyzing" }).eq("id", doc.id);
      try {
        const extracted = await runExtraction(doc as DocRow);
        const fields = schemaFor(doc.doc_type).fields;
        const hasAny = fields.some((f) => extracted?.[f] != null && extracted[f] !== "");
        const status = hasAny ? "detected" : "needs_review";
        await supa.from("fleet_documents").update({
          extracted_data: extracted,
          analysis_status: status,
          analyzed_at: new Date().toISOString(),
          analysis_notes: null,
        }).eq("id", doc.id);
        return j({ ok: true, status, extracted });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supa.from("fleet_documents").update({
          analysis_status: "failed",
          analysis_notes: msg.slice(0, 500),
        }).eq("id", doc.id);
        return j({ error: msg }, 200); // 200 so client shows message
      }
    }

    if (action === "apply") {
      const data = body?.data ?? {};
      const msg = await applyExtraction(supa, doc as DocRow, data);
      await supa.from("fleet_documents").update({
        extracted_data: data,
        analysis_status: "applied",
        applied_at: new Date().toISOString(),
        analysis_notes: null,
      }).eq("id", doc.id);
      return j({ ok: true, message: msg });
    }

    if (action === "ignore") {
      await supa.from("fleet_documents").update({ analysis_status: "ignored" }).eq("id", doc.id);
      return j({ ok: true });
    }

    return j({ error: "unknown action" }, 400);
  } catch (err) {
    return j({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
