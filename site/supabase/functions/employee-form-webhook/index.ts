// Incoming webhook (e.g. Fillout's own webhook) that creates/upserts employee form submissions.
// Auth: shared secret in `x-webhook-secret` header (must match EMPLOYEE_FORM_WEBHOOK_SECRET).
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('EMPLOYEE_FORM_WEBHOOK_SECRET') ?? '';

const ALLOWED_FORM_TYPES = ['form_101', 'employee_kit', 'foreign_employee_kit'];

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'access-control-allow-methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'method_not_allowed' }), {
      status: 405,
      headers,
    });
  }

  // 1-2: verify shared secret
  const provided = req.headers.get('x-webhook-secret') ?? '';
  if (!SECRET || provided !== SECRET) {
    return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
      status: 401,
      headers,
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'invalid_json' }), {
      status: 400,
      headers,
    });
  }

  // 3: required fields
  const fillout_submission_id = body.fillout_submission_id
    ? String(body.fillout_submission_id)
    : '';
  const form_type = body.form_type ? String(body.form_type) : '';
  const identification_number = body.identification_number
    ? String(body.identification_number)
    : '';

  if (!fillout_submission_id || !form_type || !identification_number) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'missing_required_fields',
        required: ['fillout_submission_id', 'form_type', 'identification_number'],
      }),
      { status: 400, headers },
    );
  }

  if (!ALLOWED_FORM_TYPES.includes(form_type)) {
    return new Response(
      JSON.stringify({ success: false, error: 'invalid_form_type', allowed: ALLOWED_FORM_TYPES }),
      { status: 400, headers },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const payload: Record<string, any> = {
    form_type,
    form_name: body.form_name ?? null,
    employee_name: body.employee_name ?? null,
    employee_number: body.employee_number ?? null,
    identification_type: body.identification_type ?? null,
    identification_number,
    phone: body.phone ?? null,
    fillout_form_id: body.fillout_form_id ?? null,
    fillout_submission_id,
    fillout_submission_url: body.fillout_submission_url ?? null,
    fillout_viewer_url: body.fillout_viewer_url ?? null,
    submission_data: body.submission_data ?? {},
    received_at: body.received_at ?? new Date().toISOString(),
    status: 'office_in_progress',
  };

  try {
    // 4-5: upsert on fillout_submission_id (avoid duplicates)
    const { data, error } = await supabase
      .from('employee_form_submissions')
      .upsert(payload, { onConflict: 'fillout_submission_id' })
      .select('id, status')
      .single();

    if (error) throw error;

    // 7: response
    return new Response(
      JSON.stringify({ success: true, record_id: data.id, status: data.status }),
      { status: 200, headers },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message ?? e) }),
      { status: 500, headers },
    );
  }
});
