// vtu-web/components/dashboard/transactions/StatusBadge.tsx
'use client';

import { STATUS_STYLES } from '@/lib/transactions/format';

export function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? { label: status, bg: '#F9FAFB', text: '#374151', dot: '#9CA3AF' };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
      {style.label}
    </span>
  );
}