// Supplier comparison + recommendation logic
export type QualityLevel = 'basic' | 'standard' | 'premium';

export interface SupplierOption {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  purchase_unit: string;
  pack_size: number;
  unit_price: number;
  quality: QualityLevel;
  availability: string | null;
  allow_alternative: boolean;
  notes: string | null;
}

export interface ComparisonRow extends SupplierOption {
  packs_needed: number;
  actual_units_purchased: number;
  overage_units: number;
  effective_total: number;
  effective_unit_price: number;
  tags: Array<'cheapest' | 'best_value' | 'highest_quality'>;
}

const qualityRank: Record<QualityLevel, number> = { basic: 1, standard: 2, premium: 3 };

export function compareSuppliers(
  options: SupplierOption[],
  requestedQty: number
): ComparisonRow[] {
  const rows: ComparisonRow[] = options.map((o) => {
    const pack = Math.max(1, Number(o.pack_size) || 1);
    const packsNeeded = Math.ceil(requestedQty / pack);
    const actualUnits = packsNeeded * pack;
    const overage = actualUnits - requestedQty;
    const total = packsNeeded * pack * Number(o.unit_price || 0);
    const effUnit = requestedQty > 0 ? total / requestedQty : 0;
    return {
      ...o,
      packs_needed: packsNeeded,
      actual_units_purchased: actualUnits,
      overage_units: overage,
      effective_total: total,
      effective_unit_price: effUnit,
      tags: [],
    };
  });

  if (rows.length === 0) return rows;

  // cheapest by unit_price
  const cheapest = [...rows].sort((a, b) => a.unit_price - b.unit_price)[0];
  cheapest.tags.push('cheapest');
  // best value by effective total for requested qty
  const bestValue = [...rows].sort((a, b) => a.effective_total - b.effective_total)[0];
  if (!bestValue.tags.includes('cheapest' as any)) bestValue.tags.push('best_value');
  else bestValue.tags.push('best_value');
  // highest quality
  const highest = [...rows].sort(
    (a, b) => qualityRank[b.quality] - qualityRank[a.quality] || a.effective_total - b.effective_total
  )[0];
  highest.tags.push('highest_quality');

  return rows;
}

export const qualityLabel: Record<QualityLevel, string> = {
  basic: 'בסיסי',
  standard: 'רגיל',
  premium: 'פרימיום',
};

export const tagLabel: Record<'cheapest' | 'best_value' | 'highest_quality', string> = {
  cheapest: 'הכי זול',
  best_value: 'הכי משתלם',
  highest_quality: 'הכי איכותי',
};
