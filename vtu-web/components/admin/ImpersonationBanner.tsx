// vtu-web/components/admin/ImpersonationBanner.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Eye, X, Loader2, Clock } from 'lucide-react';
import type { ImpersonationState } from '@/hooks/useImpersonation';

const B = {
  orange: '#F97316',
  orangeDark: '#EA580C',
};

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ImpersonationBanner({
  session,
  onEnd,
  ending,
}: {
  session: ImpersonationState;
  onEnd: () => void;
  ending: boolean;
}) {
  const [remaining, setRemaining] = useState(() => formatRemaining(session.expiresAt));

  useEffect(() => {
    const t = setInterval(() => setRemaining(formatRemaining(session.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [session.expiresAt]);

  // Auto-end when expired
  useEffect(() => {
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      onEnd();
    }
  }, [remaining, session.expiresAt, onEnd]);

  return (
    <div
      className="sticky top-0 z-50 flex flex-wrap items-center gap-2 px-4 py-2 text-sm font-medium text-white sm:gap-3 sm:px-6"
      style={{ background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})` }}
    >
      <span className="flex items-center gap-1.5">
        <Eye size={15} />
        Viewing as <strong>{session.targetUser.displayName}</strong>
        <span className="hidden opacity-80 sm:inline">({session.targetUser.email})</span>
      </span>

      <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-black/15 px-2 py-1 text-xs">
        <Clock size={12} />
        {remaining}
      </span>

      <button
        onClick={onEnd}
        disabled={ending}
        className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold transition hover:bg-white/30 disabled:opacity-60"
      >
        {ending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
        End impersonation
      </button>

      <p className="w-full text-[11px] opacity-90 sm:hidden">
        Financial actions are disabled while impersonating.
      </p>
      <p className="hidden text-[11px] opacity-90 sm:block sm:w-full">
        All actions are logged. Financial operations (debit, withdrawal, transfer) are disabled while impersonating.
      </p>
    </div>
  );
}