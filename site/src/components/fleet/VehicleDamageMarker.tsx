import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

export type DamageMarker = { view?: string; x: number; y: number; note?: string };

/**
 * Composite car diagram: top view + right side + left side (like an insurance/assessor report).
 * Markers stored as { view, x%, y% } — percentages are LOCAL to each sub-view so they stay
 * pixel-perfect regardless of the composite scale. Legacy markers without a `view` are treated
 * as "top" and render exactly where they used to.
 */

// Each sub-view is a 200x300 slot inside a horizontal composite (600x300).
const SLOTS: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
  top:   { x: 0,   y: 0, w: 200, h: 300, label: "מבט על" },
  right: { x: 210, y: 0, w: 180, h: 300, label: "צד ימין" },
  left:  { x: 400, y: 0, w: 180, h: 300, label: "צד שמאל" },
};

const CANVAS_W = 590;
const CANVAS_H = 300;

export function VehicleDamageMarker({
  markers,
  onChange,
  readOnly,
}: {
  markers: DamageMarker[];
  onChange?: (m: DamageMarker[]) => void;
  readOnly?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const list: DamageMarker[] = markers.map(m => ({ ...m, view: m.view ?? "top" }));

  const addAt = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // convert client px → viewBox coords
    const vx = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const vy = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    // find which slot was hit
    const hit = Object.entries(SLOTS).find(([, s]) =>
      vx >= s.x && vx <= s.x + s.w && vy >= s.y && vy <= s.y + s.h
    );
    if (!hit) return;
    const [view, s] = hit;
    const x = ((vx - s.x) / s.w) * 100;
    const y = ((vy - s.y) / s.h) * 100;
    onChange([...list, { view, x, y }]);
  };

  const remove = (i: number) => onChange?.(list.filter((_, idx) => idx !== i));
  const clearAll = () => onChange?.([]);

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {readOnly
            ? `${list.length} נקודות נזק`
            : "הקש/י בכל מקום על הרכב להוספת סימון · הקשה על סימון קיים תמחק אותו"}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoom <= 1}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-[11px] w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="w-full overflow-auto rounded-lg border bg-muted/20">
        <div style={{ width: `${100 * zoom}%`, minWidth: `${100 * zoom}%` }}>
          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            onClick={addAt}
            preserveAspectRatio="xMidYMid meet"
            className={`w-full block ${readOnly ? "" : "cursor-crosshair touch-manipulation"}`}
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          >
            {/* slot backgrounds + labels */}
            {Object.entries(SLOTS).map(([k, s]) => (
              <g key={k}>
                <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="transparent" />
                <text x={s.x + s.w / 2} y={s.y + 14} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))" fontWeight="600">
                  {s.label}
                </text>
              </g>
            ))}

            <g transform={`translate(${SLOTS.top.x},${SLOTS.top.y})`}>
              <CarTop w={SLOTS.top.w} h={SLOTS.top.h} />
            </g>
            <g transform={`translate(${SLOTS.right.x},${SLOTS.right.y})`}>
              <CarSide w={SLOTS.right.w} h={SLOTS.right.h} facing="right" />
            </g>
            <g transform={`translate(${SLOTS.left.x},${SLOTS.left.y})`}>
              <CarSide w={SLOTS.left.w} h={SLOTS.left.h} facing="left" />
            </g>

            {/* dividers */}
            <line x1={SLOTS.top.w + 5} x2={SLOTS.top.w + 5} y1="24" y2={CANVAS_H - 10} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <line x1={SLOTS.right.x + SLOTS.right.w + 5} x2={SLOTS.right.x + SLOTS.right.w + 5} y1="24" y2={CANVAS_H - 10} stroke="hsl(var(--border))" strokeDasharray="4 4" />

            {/* markers */}
            {list.map((m, i) => {
              const s = SLOTS[m.view ?? "top"] ?? SLOTS.top;
              const cx = s.x + (m.x / 100) * s.w;
              const cy = s.y + (m.y / 100) * s.h;
              return (
                <g key={i} onClick={(ev) => { ev.stopPropagation(); if (!readOnly) remove(i); }} style={{ cursor: readOnly ? "default" : "pointer" }}>
                  <circle cx={cx} cy={cy} r="9" fill="hsl(var(--destructive))" stroke="white" strokeWidth="2" />
                  <text x={cx} y={cy + 3} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">{i + 1}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {list.length > 0 && !readOnly && (
        <div className="text-center">
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            <X className="h-3 w-3 ml-1" />ניקוי כל הסימונים
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- SVG car parts ---------------- */

function CarTop({ w, h }: { w: number; h: number }) {
  const stroke = "hsl(var(--border))";
  const body = "hsl(var(--card))";
  const glass = "hsl(var(--muted))";
  const dark = "hsl(var(--foreground))";
  // draw within local 0..w / 0..h — scale from base 200x300
  const sx = (n: number) => (n / 200) * w;
  const sy = (n: number) => (n / 300) * h;
  return (
    <g>
      <rect x={sx(45)} y={sy(30)} width={sx(110)} height={sy(250)} rx={sx(30)} fill={body} stroke={stroke} strokeWidth="2" />
      {/* front windshield */}
      <path d={`M ${sx(55)} ${sy(80)} L ${sx(145)} ${sy(80)} L ${sx(138)} ${sy(115)} L ${sx(62)} ${sy(115)} Z`} fill={glass} opacity="0.7" />
      {/* rear windshield */}
      <path d={`M ${sx(62)} ${sy(205)} L ${sx(138)} ${sy(205)} L ${sx(145)} ${sy(240)} L ${sx(55)} ${sy(240)} Z`} fill={glass} opacity="0.7" />
      {/* roof line */}
      <line x1={sx(45)} y1={sy(160)} x2={sx(155)} y2={sy(160)} stroke={stroke} strokeDasharray="3" />
      {/* mirrors */}
      <rect x={sx(35)} y={sy(70)} width={sx(10)} height={sy(28)} rx="3" fill={dark} opacity="0.55" />
      <rect x={sx(155)} y={sy(70)} width={sx(10)} height={sy(28)} rx="3" fill={dark} opacity="0.55" />
      {/* wheels */}
      <rect x={sx(35)} y={sy(225)} width={sx(10)} height={sy(28)} rx="3" fill={dark} opacity="0.55" />
      <rect x={sx(155)} y={sy(225)} width={sx(10)} height={sy(28)} rx="3" fill={dark} opacity="0.55" />
      <text x={sx(100)} y={sy(52)} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">חזית</text>
      <text x={sx(100)} y={sy(275)} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">אחור</text>
    </g>
  );
}

function CarSide({ w, h, facing }: { w: number; h: number; facing: "right" | "left" }) {
  const stroke = "hsl(var(--border))";
  const body = "hsl(var(--card))";
  const glass = "hsl(var(--muted))";
  const dark = "hsl(var(--foreground))";
  const sx = (n: number) => (n / 180) * w;
  const sy = (n: number) => (n / 300) * h;

  // base drawing faces to the right (hood on the right). Flip for "left" side view.
  const mid = h / 2;
  const bodyPath = `
    M ${sx(15)} ${sy(180)}
    Q ${sx(15)} ${sy(140)} ${sx(35)} ${sy(135)}
    L ${sx(55)} ${sy(90)}
    Q ${sx(75)} ${sy(75)} ${sx(115)} ${sy(75)}
    L ${sx(140)} ${sy(120)}
    Q ${sx(165)} ${sy(130)} ${sx(165)} ${sy(160)}
    L ${sx(165)} ${sy(200)}
    Q ${sx(165)} ${sy(215)} ${sx(150)} ${sy(215)}
    L ${sx(30)} ${sy(215)}
    Q ${sx(15)} ${sy(215)} ${sx(15)} ${sy(200)}
    Z
  `;

  return (
    <g transform={facing === "left" ? `translate(${w},${mid - mid}) scale(-1,1) translate(0,0)` : undefined}>
      <path d={bodyPath} fill={body} stroke={stroke} strokeWidth="2" />
      {/* windows */}
      <path d={`M ${sx(55)} ${sy(95)} L ${sx(115)} ${sy(85)} L ${sx(135)} ${sy(125)} L ${sx(55)} ${sy(130)} Z`} fill={glass} opacity="0.7" />
      {/* door line */}
      <line x1={sx(95)} y1={sy(130)} x2={sx(95)} y2={sy(210)} stroke={stroke} strokeDasharray="2 3" />
      {/* wheels */}
      <circle cx={sx(45)} cy={sy(220)} r={sx(20)} fill={dark} opacity="0.75" />
      <circle cx={sx(45)} cy={sy(220)} r={sx(9)} fill={body} />
      <circle cx={sx(140)} cy={sy(220)} r={sx(20)} fill={dark} opacity="0.75" />
      <circle cx={sx(140)} cy={sy(220)} r={sx(9)} fill={body} />
      {/* headlight / taillight hints */}
      <rect x={sx(155)} y={sy(165)} width={sx(10)} height={sy(15)} rx="2" fill="#fde68a" opacity="0.8" />
      <rect x={sx(15)} y={sy(165)} width={sx(10)} height={sy(15)} rx="2" fill="#fca5a5" opacity="0.8" />
    </g>
  );
}
