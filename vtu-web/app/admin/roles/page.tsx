// vtu-web/app/admin/roles/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Lock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  green: '#22C55E',
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  surface: '#F9FAFB',
  white: '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleRecord {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  userCount: number;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

type PermissionGroups = Record<string, string[]>;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prettyPermission(p: string): string {
  const [resource, action] = p.split(':');
  if (!action) return p;
  return `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
}

function prettyGroupCount(perms: string[], selected: Set<string>): string {
  const count = perms.filter((p) => selected.has(p)).length;
  return `${count}/${perms.length}`;
}

// ─── Confirm delete modal ───────────────────────────────────────────────────

function DeleteModal({
  role,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  role: RoleRecord;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        style={{ border: `1px solid ${B.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: '#FEF2F2' }}
          >
            <AlertTriangle className="h-5 w-5" style={{ color: '#DC2626' }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: B.text }}>
              Delete role "{role.name}"?
            </h2>
            <p className="mt-1 text-sm" style={{ color: B.muted }}>
              This cannot be undone. {role.userCount > 0
                ? `This role has ${role.userCount} user${role.userCount === 1 ? '' : 's'} — reassign them first.`
                : 'No users are currently assigned to this role.'}
            </p>
          </div>
        </div>

        {error && (
          <div
            className="mt-4 rounded-xl px-4 py-3 text-sm"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: B.border, color: B.text }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || role.userCount > 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: '#DC2626' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Deleting…' : 'Delete role'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit role modal ───────────────────────────────────────────────

function RoleFormModal({
  mode,
  role,
  permissionGroups,
  loading,
  error,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  role: RoleRecord | null;
  permissionGroups: PermissionGroups;
  loading: boolean;
  error: string | null;
  onSubmit: (input: { name: string; description: string; permissions: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(Object.keys(permissionGroups)));

  const isSystemRole = !!role?.isSystemRole;
  const isSuperAdmin = role?.id === 'super_admin';

  const togglePermission = (perm: string) => {
    if (isSuperAdmin && ['admin:impersonate', 'roles:assign', 'system:settings'].includes(perm)) {
      return; // locked for super_admin
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const toggleGroupAll = (perms: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = perms.every((p) => next.has(p));
      for (const p of perms) {
        if (isSuperAdmin && ['admin:impersonate', 'roles:assign', 'system:settings'].includes(p)) continue;
        if (allSelected) next.delete(p);
        else next.add(p);
      }
      return next;
    });
  };

  const toggleGroupOpen = (group: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      permissions: Array.from(selected),
    });
  };

  const nameInvalid = name.trim().length < 2;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl"
        style={{ border: `1px solid ${B.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: B.border }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: B.text }}>
              {mode === 'create' ? 'Create role' : `Edit role — ${role?.name}`}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: B.faint }}>
              {isSystemRole
                ? 'System role — name and description are locked, permissions can be tuned.'
                : 'Pick a name, description, and the permissions this role grants.'}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
            style={{ color: B.muted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Name + description */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: B.faint }}>
                ROLE NAME
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystemRole}
                placeholder="e.g. Finance Officer"
                className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60"
                style={{ borderColor: B.border, color: B.text }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: B.faint }}>
                DESCRIPTION
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSystemRole}
                placeholder="What this role is for"
                className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60"
                style={{ borderColor: B.border, color: B.text }}
              />
            </div>
          </div>

          {/* Permission checklist */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold" style={{ color: B.faint }}>
                PERMISSIONS
              </label>
              <span className="text-xs" style={{ color: B.faint }}>
                {selected.size} selected
              </span>
            </div>

            <div className="space-y-2">
              {Object.entries(permissionGroups).map(([group, perms]) => {
                const open = openGroups.has(group);
                const allSelected = perms.every((p) => selected.has(p));
                const someSelected = perms.some((p) => selected.has(p));

                return (
                  <div
                    key={group}
                    className="overflow-hidden rounded-xl border"
                    style={{ borderColor: B.border }}
                  >
                    <button
                      onClick={() => toggleGroupOpen(group)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-gray-50"
                      style={{ background: B.surface }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          role="checkbox"
                          aria-checked={allSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupAll(perms);
                          }}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition"
                          style={{
                            borderColor: allSelected || someSelected ? B.orange : B.border,
                            background: allSelected ? B.orange : someSelected ? 'rgba(249,115,22,0.15)' : 'transparent',
                          }}
                        >
                          {allSelected && <CheckCircle size={11} className="text-white" />}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: B.text }}>
                          {group}
                        </span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: 'rgba(249,115,22,0.1)', color: B.orange }}
                        >
                          {prettyGroupCount(perms, selected)}
                        </span>
                      </div>
                      {open ? (
                        <ChevronDown size={14} style={{ color: B.faint }} />
                      ) : (
                        <ChevronRight size={14} style={{ color: B.faint }} />
                      )}
                    </button>

                    {open && (
                      <div className="grid grid-cols-2 gap-1.5 px-3 py-3 sm:grid-cols-3" style={{ borderTop: `1px solid ${B.border}` }}>
                        {perms.map((perm) => {
                          const checked = selected.has(perm);
                          const locked =
                            isSuperAdmin &&
                            ['admin:impersonate', 'roles:assign', 'system:settings'].includes(perm);

                          return (
                            <label
                              key={perm}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition"
                              style={{
                                background: checked ? 'rgba(249,115,22,0.06)' : 'transparent',
                                color: locked ? B.faint : B.text,
                                cursor: locked ? 'not-allowed' : 'pointer',
                              }}
                              title={perm}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={locked}
                                onChange={() => togglePermission(perm)}
                                className="h-3.5 w-3.5 shrink-0 accent-orange-500"
                              />
                              <span className="truncate">{prettyPermission(perm)}</span>
                              {locked && <Lock size={10} className="ml-auto shrink-0" />}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              className="mt-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t px-6 py-4" style={{ borderColor: B.border }}>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: B.border, color: B.text }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || nameInvalid}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving…' : mode === 'create' ? 'Create role' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: RoleRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(249,115,22,0.10)' }}
          >
            <Shield size={18} style={{ color: B.orange }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold" style={{ color: B.text }}>
                {role.name}
              </p>
              {role.isSystemRole && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: B.surface, color: B.faint }}
                >
                  <Lock size={9} /> System
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs" style={{ color: B.faint }}>
              {role.description || 'No description'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
            style={{ color: B.muted }}
            title="Edit role"
          >
            <Pencil size={14} />
          </button>
          {!role.isSystemRole && (
            <button
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-red-50"
              style={{ color: '#DC2626' }}
              title="Delete role"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: B.muted }}>
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          {role.userCount} user{role.userCount === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Shield size={12} />
          {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroups>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal state
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [formRole, setFormRole] = useState<RoleRecord | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteRole, setDeleteRole] = useState<RoleRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/internal/roles');
      const json: ApiResponse<{ roles: RoleRecord[]; permissionGroups: PermissionGroups }> = await res.json();
      if (!json.success || !json.data) throw new Error(json.error ?? 'Failed to load roles');
      setRoles(json.data.roles);
      setPermissionGroups(json.data.permissionGroups);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Create / Edit submit ──────────────────────────────────────────────────
  const handleFormSubmit = async (input: { name: string; description: string; permissions: string[] }) => {
    setFormLoading(true);
    setFormError(null);

    try {
      if (formMode === 'create') {
        const res = await fetch('/api/internal/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const json: ApiResponse<{ role: RoleRecord }> = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Failed to create role');
        setToast(json.message ?? `Role "${input.name}" created.`);
      } else if (formMode === 'edit' && formRole) {
        const res = await fetch('/api/internal/roles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleId: formRole.id, ...input }),
        });
        const json: ApiResponse<{ role: RoleRecord }> = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Failed to update role');
        setToast(json.message ?? `Role "${input.name}" updated.`);
      }

      setFormMode(null);
      setFormRole(null);
      fetchRoles();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteRole) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/internal/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: deleteRole.id }),
      });
      const json: ApiResponse<{ roleId: string }> = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Failed to delete role');

      setToast(json.message ?? `Role "${deleteRole.name}" deleted.`);
      setDeleteRole(null);
      fetchRoles();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalUsers = roles.reduce((sum, r) => sum + (r.userCount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: B.text }}>
            Roles &amp; Permissions
          </h1>
          <p className="text-sm" style={{ color: B.muted }}>
            Create custom roles and control what each can do — takes effect immediately, no deploy needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRoles}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: B.border, color: B.muted }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => {
              setFormMode('create');
              setFormRole(null);
              setFormError(null);
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}
          >
            <Plus size={14} />
            New role
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(249,115,22,0.12)', color: B.orange }}>
              <Shield size={15} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: B.text }}>{roles.length}</p>
              <p className="mt-0.5 text-xs" style={{ color: B.faint }}>Roles</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: '#ECFDF5', color: '#059669' }}>
              <Users size={15} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: B.text }}>{totalUsers}</p>
              <p className="mt-0.5 text-xs" style={{ color: B.faint }}>Assigned users</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <Lock size={15} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: B.text }}>
                {roles.filter((r) => r.isSystemRole).length}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: B.faint }}>System roles</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <Shield size={15} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: B.text }}>
                {Object.values(permissionGroups).flat().length}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: B.faint }}>Total permissions</p>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border px-5 py-4" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
          <AlertTriangle size={16} color="#DC2626" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchRoles} className="ml-auto text-sm font-semibold text-red-700 underline">
            Retry
          </button>
        </div>
      )}

      {/* Role grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl" style={{ background: B.border }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded" style={{ background: B.border }} />
                    <div className="h-3 w-40 rounded" style={{ background: B.border }} />
                  </div>
                </div>
              </div>
            ))
          : roles.length === 0
          ? (
              <div className="col-span-full rounded-2xl border bg-white py-16 text-center" style={{ borderColor: B.border, color: B.faint }}>
                <Shield size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No roles yet</p>
                <p className="mt-1 text-xs">Create your first custom role to get started.</p>
              </div>
            )
          : roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={() => {
                  setFormMode('edit');
                  setFormRole(role);
                  setFormError(null);
                }}
                onDelete={() => {
                  setDeleteRole(role);
                  setDeleteError(null);
                }}
              />
            ))}
      </div>

      {/* Create / Edit modal */}
      {formMode && (
        <RoleFormModal
          mode={formMode}
          role={formRole}
          permissionGroups={permissionGroups}
          loading={formLoading}
          error={formError}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            if (formLoading) return;
            setFormMode(null);
            setFormRole(null);
            setFormError(null);
          }}
        />
      )}

      {/* Delete modal */}
      {deleteRole && (
        <DeleteModal
          role={deleteRole}
          loading={deleteLoading}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => {
            if (deleteLoading) return;
            setDeleteRole(null);
            setDeleteError(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-xl"
          style={{ background: '#059669' }}
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle size={14} />
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}