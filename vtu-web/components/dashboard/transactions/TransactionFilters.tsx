// vtu-web/components/dashboard/transactions/TransactionFilters.tsx
'use client';

import { CATEGORY_OPTIONS, STATUS_OPTIONS } from '@/lib/transactions/format';

const BRAND = {
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  orange: '#F97316',
};

export interface TransactionFiltersValue {
  category: string;
  status: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFiltersValue = {
  category: '',
  status: '',
  startDate: '',
  endDate: '',
};

interface Props {
  value: TransactionFiltersValue;
  onChange: (next: TransactionFiltersValue) => void;
}

export function TransactionFilters({ value, onChange }: Props) {
  const hasActiveFilters = Boolean(
    value.category || value.status || value.startDate || value.endDate
  );

  const set = (patch: Partial<TransactionFiltersValue>) => onChange({ ...value, ...patch });

  const fieldClass =
    'rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-[#F97316]';

  return (
    <div
      className="flex flex-wrap items-end gap-3 rounded-2xl border p-4"
      style={{ borderColor: BRAND.border, background: '#fff' }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: BRAND.textMuted }}>
          Service
        </label>
        <select
          value={value.category}
          onChange={(e) => set({ category: e.target.value })}
          className={fieldClass}
          style={{ borderColor: BRAND.border, color: BRAND.text }}
        >
          <option value="">All services</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: BRAND.textMuted }}>
          Status
        </label>
        <select
          value={value.status}
          onChange={(e) => set({ status: e.target.value })}
          className={fieldClass}
          style={{ borderColor: BRAND.border, color: BRAND.text }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: BRAND.textMuted }}>
          From
        </label>
        <input
          type="date"
          value={value.startDate}
          max={value.endDate || undefined}
          onChange={(e) => set({ startDate: e.target.value })}
          className={fieldClass}
          style={{ borderColor: BRAND.border, color: BRAND.text }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: BRAND.textMuted }}>
          To
        </label>
        <input
          type="date"
          value={value.endDate}
          min={value.startDate || undefined}
          onChange={(e) => set({ endDate: e.target.value })}
          className={fieldClass}
          style={{ borderColor: BRAND.border, color: BRAND.text }}
        />
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_TRANSACTION_FILTERS)}
          className="rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-[#FFF7ED]"
          style={{ color: BRAND.orange }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}