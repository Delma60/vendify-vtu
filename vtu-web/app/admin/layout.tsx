// vtu-web/app/admin/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart2,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Shield,
  Zap,
  FileText,
  DollarSign,
  Megaphone,
  Wrench,
  Globe,
  Bug,
  ShoppingBag,
  Ticket,
  Tags,
  Radio,
  BookOpen,
  Key,
  Activity,
  UserCheck,
  Package,
  AlertOctagon,
  ScrollText,
  PieChart,
  TrendingUp,
  Landmark,
  SlidersHorizontal,
  HardDrive,
} from 'lucide-react';
import { useImpersonation } from '@/hooks/useImpersonation';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const B = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  green: '#22C55E',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  border: '#E5E7EB',
  surface: '#F9FAFB',
};

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavLeaf = { href: string; label: string; icon: React.ElementType; badge?: string };
type NavGroup = { label: string; icon: React.ElementType; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;
type NavSection = { label: string; items: NavItem[] };

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}

const ADMIN_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/analytics', label: 'Analytics', icon: PieChart },
      { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    label: 'Users',
    items: [
      {
        label: 'User Management',
        icon: Users,
        children: [
          { href: '/admin/users', label: 'All Users', icon: Users },
          { href: '/admin/users/kyc', label: 'KYC Verification', icon: UserCheck },
          { href: '/admin/roles', label: 'Roles & Permissions', icon: Shield },
        ],
      },
      { href: '/admin/support', label: 'Support Tickets', icon: Megaphone },
      { href: '/admin/disputes', label: 'Disputes', icon: AlertOctagon },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { href: '/admin/transactions', label: 'All Transactions', icon: CreditCard },
      { href: '/admin/transactions/refunds', label: 'Refunds', icon: DollarSign },
      { href: '/admin/fraud', label: 'Fraud Flags', icon: Bug },
      { href: '/admin/dlq', label: 'Dead Letter Queue', icon: HardDrive },
    ],
  },
  {
    label: 'Services & Providers',
    items: [
      {
        label: 'Providers',
        icon: Radio,
        children: [
          { href: '/admin/providers', label: 'Provider Config', icon: SlidersHorizontal },
          { href: '/admin/providers/floats', label: 'Float Management', icon: Landmark },
          { href: '/admin/providers/prices', label: 'Price Sync', icon: TrendingUp },
        ],
      },
      {
        label: 'Services',
        icon: Package,
        children: [
          { href: '/admin/services/data-plans', label: 'Data Plans', icon: Globe },
          { href: '/admin/services/cable', label: 'Cable Bouquets', icon: Ticket },
          { href: '/admin/services/exam-pins', label: 'Exam Pins', icon: BookOpen },
          { href: '/admin/services/a2c', label: 'Airtime to Cash', icon: DollarSign },
        ],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/wallets', label: 'Wallets', icon: Landmark },
      { href: '/admin/withdrawals', label: 'Withdrawals', icon: FileText },
      { href: '/admin/commissions', label: 'Commissions', icon: BarChart2 },
      { href: '/admin/loans', label: 'Loans', icon: CreditCard },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/admin/subscriptions', label: 'Subscription Plans', icon: ShoppingBag },
      { href: '/admin/cashback', label: 'Cashback Campaigns', icon: Tags },
      { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
      { href: '/admin/events', label: 'Events', icon: Megaphone },
    ],
  },
  {
    label: 'API',
    items: [
      { href: '/admin/api-keys', label: 'API Keys', icon: Key },
      { href: '/admin/api-logs', label: 'API Logs', icon: ScrollText },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
      { href: '/admin/ip-blacklist', label: 'IP Blacklist', icon: Shield },
      { href: '/admin/geo', label: 'Geo Blocking', icon: Globe },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}

function groupHasActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((c) => isActive(c.href, pathname));
}

// ─── NavLeafItem ─────────────────────────────────────────────────────────────

function NavLeafItem({
  item,
  pathname,
  collapsed,
  nested = false,
  onNavigate,
}: {
  item: NavLeaf;
  pathname: string;
  collapsed: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        'group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150',
        nested && !collapsed ? 'pl-9 pr-3 py-2' : 'px-3 py-2.5',
        collapsed ? '!justify-center !px-2' : '',
        active ? 'text-white shadow-md' : 'text-gray-500 hover:bg-orange-50 hover:text-gray-900',
      ].join(' ')}
      style={
        active
          ? {
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              boxShadow: '0 4px 14px rgba(249,115,22,0.22)',
            }
          : undefined
      }
    >
      {/* Connector dot for nested */}
      {nested && !collapsed && (
        <span
          className="absolute left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{ background: active ? 'rgba(255,255,255,0.7)' : B.border }}
        />
      )}

      <Icon
        size={nested ? 14 : 17}
        strokeWidth={1.9}
        className="shrink-0"
        style={{ color: active ? '#fff' : B.textFaint }}
      />

      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

      {!collapsed && item.badge && (
        <span
          className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{
            background: active ? 'rgba(255,255,255,0.25)' : 'rgba(249,115,22,0.12)',
            color: active ? '#fff' : B.orange,
          }}
        >
          {item.badge}
        </span>
      )}

      {active && !collapsed && !item.badge && (
        <ChevronRight size={13} className="ml-auto shrink-0 text-white/70" />
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <span
          className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
          style={{ background: '#fff', borderColor: B.border, color: B.text }}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

// ─── NavGroupItem ─────────────────────────────────────────────────────────────

function NavGroupItem({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavGroup;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = groupHasActive(item, pathname);
  const [open, setOpen] = useState(active);
  const Icon = item.icon;

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (collapsed) {
    return (
      <div className="group relative">
        <button
          className={[
            'flex w-full items-center justify-center rounded-xl px-2 py-2.5 transition-all duration-150',
            active ? 'text-white shadow-md' : 'text-gray-400 hover:bg-orange-50',
          ].join(' ')}
          style={
            active
              ? {
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  boxShadow: '0 4px 14px rgba(249,115,22,0.22)',
                }
              : undefined
          }
        >
          <Icon size={17} strokeWidth={1.9} style={{ color: active ? '#fff' : B.textFaint }} />
        </button>

        {/* Flyout tooltip */}
        <div
          className="pointer-events-none absolute left-full top-0 z-50 ml-3 min-w-[172px] rounded-xl border bg-white p-2 opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
          style={{ borderColor: B.border }}
        >
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: B.textFaint }}>
            {item.label}
          </p>
          {item.children.map((c) => (
            <NavLeafItem key={c.href} item={c} pathname={pathname} collapsed={false} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
          active ? 'bg-orange-50 text-gray-900' : 'text-gray-500 hover:bg-orange-50 hover:text-gray-900',
        ].join(' ')}
      >
        <Icon
          size={17}
          strokeWidth={1.9}
          className="shrink-0"
          style={{ color: active ? B.orange : B.textFaint }}
        />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          size={13}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: active ? B.orange : B.textFaint,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Children */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: open ? `${item.children.length * 44}px` : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="relative mt-0.5 space-y-0.5 pb-1">
          {/* Connector line */}
          <div
            className="absolute bottom-2 left-[22px] top-0 w-px"
            style={{ background: B.border }}
          />
          {item.children.map((c) => (
            <NavLeafItem key={c.href} item={c} pathname={pathname} collapsed={false} nested onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Logout modal ─────────────────────────────────────────────────────────────

function LogoutModal({
  onCancel,
  onConfirm,
  loading,
  error,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onCancel(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onCancel, loading]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
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
            style={{ background: 'rgba(249,115,22,0.12)' }}
          >
            <AlertTriangle className="h-5 w-5" style={{ color: B.orange }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: B.text }}>Sign out of admin?</h2>
            <p className="mt-1 text-sm" style={{ color: B.textMuted }}>
              You'll need to log in again to access the admin panel.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ border: `1.5px solid ${B.border}`, color: B.text }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onCollapse,
  onNavigate,
  onLogout,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Logo */}
      <div
        className={`flex items-center border-b py-5 ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
        style={{ borderColor: B.border }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #F97316, #22C55E)', boxShadow: '0 4px 14px rgba(249,115,22,0.25)' }}
        >
          <Zap size={18} className="text-white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight" style={{ color: B.text }}>VendPro</p>
            <p className="truncate text-[11px] font-medium" style={{ color: B.orange }}>Admin Panel</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
        {ADMIN_NAV.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p
                className="mb-1.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: B.textFaint }}
              >
                {section.label}
              </p>
            )}
            <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
              {section.items.map((item) =>
                isGroup(item) ? (
                  <NavGroupItem
                    key={item.label}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <NavLeafItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className={`border-t py-3 ${collapsed ? 'px-2' : 'px-3'}`} style={{ borderColor: B.border }}>
        <div className="space-y-0.5">
          <button
            className={[
              'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-gray-50',
              collapsed ? 'justify-center !px-2' : '',
            ].join(' ')}
            style={{ color: B.textMuted }}
          >
            <Bell size={17} strokeWidth={1.9} className="shrink-0" style={{ color: B.textFaint }} />
            {!collapsed && <span>Notifications</span>}
            {collapsed && (
              <span
                className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
                style={{ background: '#fff', borderColor: B.border, color: B.text }}
              >
                Notifications
              </span>
            )}
          </button>

          <button
            onClick={onLogout}
            className={[
              'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-red-50',
              collapsed ? 'justify-center !px-2' : '',
            ].join(' ')}
            style={{ color: '#DC2626' }}
          >
            <LogOut size={17} strokeWidth={1.9} className="shrink-0" style={{ color: '#DC2626' }} />
            {!collapsed && <span>Sign out</span>}
            {collapsed && (
              <span
                className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
                style={{ background: '#fff', borderColor: B.border, color: '#DC2626' }}
              >
                Sign out
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={onCollapse}
        className="hidden border-t py-3 text-center text-xs transition hover:bg-gray-50 lg:block"
        style={{ borderColor: B.border, color: B.textFaint }}
      >
        {collapsed ? '→' : '← Collapse'}
      </button>
    </div>
  );
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
          style={{ border: `1px solid ${B.border}`, color: B.textMuted }}
        >
          <X size={16} />
        </button>
        <SidebarContent collapsed={false} onCollapse={() => {}} onNavigate={onClose} onLogout={onLogout} />
      </aside>
    </>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const pageTitle =
    segments.length > 1
      ? segments[segments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Dashboard';

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/80 px-4 backdrop-blur-md sm:px-6"
      style={{ borderColor: B.border }}
    >
      <button
        onClick={onMenu}
        className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-gray-50 lg:hidden"
        style={{ border: `1px solid ${B.border}`, color: B.textMuted }}
      >
        <Menu size={18} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold" style={{ color: B.text }}>
          {pageTitle}
        </h1>
        <p className="truncate text-xs" style={{ color: B.textFaint }}>
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Admin badge */}
      <span
        className="hidden rounded-lg px-2.5 py-1 text-xs font-bold sm:block"
        style={{ background: 'rgba(249,115,22,0.1)', color: B.orange }}
      >
        Admin
      </span>

      <button
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-gray-50"
        style={{ border: `1px solid ${B.border}`, color: B.textMuted }}
      >
        <Bell size={17} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: B.orange }} />
      </button>

      <button
        className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition hover:opacity-80"
        style={{ background: 'rgba(249,115,22,0.12)', color: B.orange }}
      >
        A
      </button>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const router = useRouter();

  const { session: impersonationSession, end: endImpersonation, loading: endingImpersonation } = useImpersonation();

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Failed to sign out.');
      setShowLogout(false);
      router.push('/login');
      router.refresh();
    } catch (e: any) {
      setLogoutError(e.message ?? 'Something went wrong.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white" style={{ color: B.text }}>
      {/* Desktop sidebar */}
      <aside
        className={`hidden flex-col border-r transition-all duration-300 ease-in-out lg:flex ${collapsed ? 'w-[68px]' : 'w-64'}`}
        style={{ minHeight: '100vh', borderColor: B.border }}
      >
        <SidebarContent
          collapsed={collapsed}
          onCollapse={() => setCollapsed((c) => !c)}
          onLogout={() => setShowLogout(true)}
        />
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={() => { setMobileOpen(false); setShowLogout(true); }}
      />

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {impersonationSession && (
          <ImpersonationBanner
            session={impersonationSession}
            onEnd={endImpersonation}
            ending={endingImpersonation}
          />
        )}
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="min-h-full p-4 sm:p-6">{children}</div>
        </main>
      </div>

      {/* Logout modal */}
      {showLogout && (
        <LogoutModal
          onCancel={() => { if (!loggingOut) { setShowLogout(false); setLogoutError(null); } }}
          onConfirm={handleLogout}
          loading={loggingOut}
          error={logoutError}
        />
      )}

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}