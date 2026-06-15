// vtu-web/hooks/useImpersonation.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'vtu_impersonation';

export interface ImpersonationState {
  token: string;
  expiresAt: string; // ISO
  targetUser: {
    uid: string;
    displayName: string;
    email: string;
    roleId: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Tracks the active impersonation session in sessionStorage (cleared when the
 * admin closes the tab) and exposes helpers to start/end it.
 *
 * The token is sent as the `X-Impersonating` header on subsequent requests —
 * see AGENTS.md "Admin Impersonation" section. Financial routes reject any
 * request carrying this header.
 */
export function useImpersonation() {
  const [session, setSession] = useState<ImpersonationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: ImpersonationState = JSON.parse(raw);
      if (new Date(parsed.expiresAt).getTime() > Date.now()) {
        setSession(parsed);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const start = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/internal/users/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json: ApiResponse<{
        token: string;
        expiresAt: string;
        targetUser: ImpersonationState['targetUser'];
      }> = await res.json();

      if (!json.success || !json.data) throw new Error(json.error ?? 'Failed to start impersonation');

      const next: ImpersonationState = {
        token: json.data.token,
        expiresAt: json.data.expiresAt,
        targetUser: json.data.targetUser,
      };

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      return next;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to start impersonation';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const end = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/internal/users/impersonate', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          [/* mirrors header constant */ 'x-impersonating']: session.token,
        },
        body: JSON.stringify({ token: session.token }),
      });
    } catch (e) {
      // Best-effort — clear local state regardless so the admin isn't stuck
      console.error('[impersonation] failed to end session cleanly', e);
    } finally {
      sessionStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setLoading(false);
    }
  }, [session]);

  return { session, start, end, loading, error, setError };
}