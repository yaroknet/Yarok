import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfLine {
  supplier_sku?: string | null;
  product_name: string;
  unit: string; // יחידות במארז / יחידה
  quantity: number;
  note?: string | null;
  unit_price?: number | null;
  total?: number | null;
}

export interface PdfOrderData {
  supplier_name: string;
  supplier_contacts?: { name?: string; phone?: string; email?: string }[];
  order_number: string;
  date: string;
  billing_entity?: string | null;
  client_name?: string | null;
  site_name?: string | null;
  shipping_address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  shipping_notes?: string | null;
  lines: PdfLine[];
  include_prices?: boolean;
  vat_rate?: number; // default 18
  logo_url?: string | null;
  variant?: 'original' | 'update' | 'cancellation';
  version_number?: number;
  banner_text?: string | null;
  change_summary_text?: string | null;
  cancellation_reason?: string | null;
  cancelled_by_name?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
}

const DEFAULT_BILLING = 'ירוק שירותי אחזקה ניקיון וכח אדם בע"מ';
const DEFAULT_BILLING_ID = 'ח.פ 514854116';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const fmt = (n: number) => n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let fontsInjected = false;
function ensureHebrewFont() {
  if (fontsInjected) return;
  fontsInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap';
  document.head.appendChild(link);
}

function buildHtml(data: PdfOrderData): string {
  const billing = data.billing_entity || DEFAULT_BILLING;
  const vatRate = typeof data.vat_rate === 'number' ? data.vat_rate : 18;
  const showPrices = !!data.include_prices;

  const rows = data.lines.map((l, i) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unit_price) || 0;
    const totalBefore = l.total != null ? Number(l.total) : qty * price;
    const totalWithVat = totalBefore * (1 + vatRate / 100);
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(l.supplier_sku || '')}</td>
        <td class="r-name">${esc(l.product_name)}</td>
        <td class="c">${qty}</td>
        <td class="c">${esc(l.unit || '')}</td>
        ${showPrices ? `<td class="c">${fmt(price)}</td>` : ''}
        ${showPrices ? `<td class="c">${fmt(totalBefore)}</td>` : ''}
        ${showPrices ? `<td class="c">${fmt(totalWithVat)}</td>` : ''}
        <td class="notes">${esc(l.note || '')}</td>
      </tr>`;
  }).join('');

  const subtotal = data.lines.reduce((s, l) => {
    const t = l.total != null ? Number(l.total) : (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
    return s + t;
  }, 0);
  const vat = subtotal * (vatRate / 100);
  const grand = subtotal + vat;

  const contactsLine = (data.supplier_contacts || [])
    .map(c => [c.name, c.phone, c.email].filter(Boolean).join(' · '))
    .filter(Boolean).join(' | ');

  const colHeadPrices = showPrices ? `
    <th>מחיר ליח׳ (₪)</th>
    <th>סה״כ לפני מע״מ</th>
    <th>סה״כ כולל מע״מ</th>` : '';

  return `
  <div id="pdf-root" dir="rtl" lang="he" style="
    width: 794px; padding: 32px 36px; box-sizing: border-box;
    font-family: 'Heebo', 'Arial Hebrew', Arial, sans-serif;
    color: #111; background: #fff; font-size: 12px; line-height: 1.5;">

    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #14532d; padding-bottom: 12px;">
      <div style="text-align:right;">
        <div style="font-size:20px; font-weight:700; color:#14532d;">${esc(billing)}</div>
        <div style="font-size:12px; color:#444;">${esc(DEFAULT_BILLING_ID)}</div>
      </div>
      ${data.logo_url ? `<img src="${esc(data.logo_url)}" alt="" style="max-height:60px; max-width:160px;" crossorigin="anonymous" />` : ''}
    </div>

    <div style="display:flex; justify-content:space-between; margin-top:14px;">
      <div style="text-align:right;">
        <div style="font-size:16px; font-weight:700;">${data.variant === 'cancellation' ? 'הודעת ביטול הזמנה' : data.variant === 'update' ? `הזמנת רכש מעודכנת — גרסה ${data.version_number || 2}` : 'הזמנת רכש'}</div>
        <div>מספר הזמנה: <b>${esc(data.order_number)}</b>${data.version_number ? ` <b style="color:#b45309;">(v${data.version_number})</b>` : ''}</div>
        <div>תאריך: ${esc(data.date)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;">לכבוד ספק:</div>
        <div style="font-size:14px;">${esc(data.supplier_name)}</div>
        ${contactsLine ? `<div style="font-size:11px; color:#444;">${esc(contactsLine)}</div>` : ''}
      </div>
    </div>

    ${data.banner_text ? `
    <div style="margin-top:12px; padding:10px 14px; border:2px solid ${data.variant === 'cancellation' ? '#b91c1c' : '#b45309'}; background:${data.variant === 'cancellation' ? '#fee2e2' : '#fef3c7'}; border-radius:6px; font-weight:700; color:${data.variant === 'cancellation' ? '#7f1d1d' : '#78350f'};">
      ${esc(data.banner_text)}
    </div>` : ''}

    ${data.cancellation_reason ? `
    <div style="margin-top:10px; border:1px solid #fca5a5; background:#fef2f2; border-radius:6px; padding:8px 12px; font-size:12px;">
      <div><b>סיבת ביטול:</b> ${esc(data.cancellation_reason)}</div>
      ${data.cancelled_by_name ? `<div><b>בוצע על ידי:</b> ${esc(data.cancelled_by_name)}</div>` : ''}
    </div>` : ''}


    <div style="margin-top:14px; border:1px solid #d1d5db; border-radius:6px; padding:10px 12px; background:#f9fafb;">
      <div style="font-weight:700; margin-bottom:6px; color:#14532d;">פרטי משלוח</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px 20px;">
        ${data.site_name ? `<div><b>אתר / לקוח:</b> ${esc(data.site_name)}${data.client_name ? ' — ' + esc(data.client_name) : ''}</div>` : ''}
        ${data.shipping_address ? `<div><b>כתובת:</b> ${esc(data.shipping_address)}</div>` : ''}
        ${data.contact_name ? `<div><b>איש קשר:</b> ${esc(data.contact_name)}</div>` : ''}
        ${data.contact_phone ? `<div><b>טלפון:</b> ${esc(data.contact_phone)}</div>` : ''}
        ${data.shipping_notes ? `<div style="grid-column:1/-1;"><b>הערות שילוח:</b> ${esc(data.shipping_notes)}</div>` : ''}
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-top:14px; direction:rtl; font-size:11px;">
      <thead>
        <tr style="background:#14532d; color:#fff;">
          <th style="width:26px;">#</th>
          <th style="width:80px;">מק״ט ספק</th>
          <th>שם מוצר</th>
          <th style="width:50px;">כמות</th>
          <th style="width:70px;">יח׳ / מארז</th>
          ${colHeadPrices}
          <th style="width:110px;">הערות</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="9" style="text-align:center; padding:12px;">אין שורות</td></tr>`}</tbody>
    </table>

    ${showPrices ? `
    <div style="margin-top:12px; display:flex; justify-content:flex-start;">
      <table style="border-collapse:collapse; min-width:280px; font-size:12px;">
        <tr><td style="padding:4px 10px;">סה״כ לפני מע״מ</td><td style="padding:4px 10px; text-align:left; font-weight:600;">${fmt(subtotal)} ₪</td></tr>
        <tr><td style="padding:4px 10px;">מע״מ (${vatRate}%)</td><td style="padding:4px 10px; text-align:left; font-weight:600;">${fmt(vat)} ₪</td></tr>
        <tr style="background:#14532d; color:#fff;"><td style="padding:6px 10px;">סה״כ לתשלום</td><td style="padding:6px 10px; text-align:left; font-weight:700;">${fmt(grand)} ₪</td></tr>
      </table>
    </div>` : ''}

    ${data.change_summary_text ? `
    <div style="margin-top:14px; padding:10px 12px; border:1px solid #d1d5db; background:#f9fafb; border-radius:6px; font-size:11px; white-space:pre-wrap;">
      <div style="font-weight:700; margin-bottom:6px; color:#14532d;">סיכום שינויים בגרסה זו</div>
      ${esc(data.change_summary_text)}
    </div>` : ''}

    ${data.variant === 'cancellation' ? `
    <div style="margin-top:20px; padding:10px; border-top:2px solid #b91c1c; font-size:12px; text-align:center; font-weight:700; color:#7f1d1d;">
      נא לאשר את קבלת הודעת הביטול.
    </div>` : `
    <div style="margin-top:28px; padding:10px 12px; border:1px solid #d1d5db; background:#f9fafb; border-radius:6px; font-size:12px;">
      <div style="font-weight:700; color:#14532d; margin-bottom:4px;">אושר והופק על ידי:</div>
      <div>${esc(data.approved_by_name || '—')}</div>
      ${data.approved_at ? `<div style="color:#555; font-size:11px;">${esc(data.approved_at)}</div>` : ''}
    </div>`}

    <style>
      #pdf-root table th, #pdf-root table td {
        border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle;
        text-align: right;
      }
      #pdf-root table th { font-weight: 700; }
      #pdf-root table td.c { text-align: center; }
      #pdf-root table td.r-name { font-weight: 600; }
      #pdf-root table td.notes { color:#444; font-size:10.5px; }
      #pdf-root table tbody tr:nth-child(even) td { background:#f8fafc; }
    </style>
  </div>`;
}

export async function generateSupplierPdf(data: PdfOrderData): Promise<jsPDF> {
  ensureHebrewFont();

  // Mount hidden container
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed; top:0; left:-10000px; z-index:-1; background:#fff;';
  container.innerHTML = buildHtml(data);
  document.body.appendChild(container);

  try {
    // Wait for fonts (Heebo) to be loaded
    try {
      if ((document as any).fonts?.load) {
        await (document as any).fonts.load('700 16px Heebo');
        await (document as any).fonts.load('400 12px Heebo');
        await (document as any).fonts.ready;
      }
    } catch { /* ignore */ }

    const target = container.querySelector('#pdf-root') as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH, undefined, 'FAST');
    } else {
      // Multi-page: slice canvas
      const pageHeightPx = (canvas.width * pageH) / pageW;
      let renderedPx = 0;
      let firstPage = true;
      while (renderedPx < canvas.height) {
        const sliceH = Math.min(pageHeightPx, canvas.height - renderedPx);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceImgH = (sliceH * imgW) / canvas.width;
        if (!firstPage) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, imgW, sliceImgH, undefined, 'FAST');
        renderedPx += sliceH;
        firstPage = false;
      }
    }

    return pdf;
  } finally {
    document.body.removeChild(container);
  }
}
