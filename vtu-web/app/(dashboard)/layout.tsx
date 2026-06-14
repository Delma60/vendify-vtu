// vtu-web/app/(dashboard)/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Smartphone,
  Wifi,
  Tv,
  Zap,
  BookOpen,
  MessageSquare,
  Wallet,
  ArrowLeftRight,
  Gift,
  Users,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  TrendingDown,
  Globe,
  CreditCard,
  History,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/wallet', label: 'Wallet', icon: Wallet },
      { href: '/transactions', label: 'History', icon: History },
    ],
  },
  {
    label: 'Services',
    items: [
      { href: '/airtime', label: 'Airtime', icon: Smartphone },
      { href: '/data', label: 'Data', icon: Wifi },
      { href: '/electricity', label: 'Electricity', icon: Zap },
      { href: '/cable', label: 'Cable TV', icon: Tv },
      { href: '/internet', label: 'Internet', icon: Globe },
      { href: '/exam-pin', label: 'Exam Pins', icon: BookOpen },
      { href: '/sms', label: 'Bulk SMS', icon: MessageSquare },
    ],
  },
  {
    label: 'Earnings',
    items: [
      { href: '/cashback', label: 'Cashback', icon: Gift },
      { href: '/commissions', label: 'Commissions', icon: TrendingDown },
      { href: '/referrals', label: 'Referrals', icon: Users },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/subscription', label: 'Subscription', icon: CreditCard },
      { href: '/profile', label: 'Settings', icon: Settings },
    ],
  },
];

// ─── Brand tokens ─────────────────────────────────────────────────────────────
// Palette: white background, vibrant orange-green gradient hero,
// warm coral/orange primary (#F97316), fresh green accent (#22C55E),
// dark charcoal text (#111827)

const BRAND = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  green: '#22C55E',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  border: '#E5E7EB',
  surface: '#F9FAFB',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`
        group relative flex items-center gap-3 rounded-xl px-3 py-2.5
        text-sm font-medium transition-all duration-150
        ${active
          ? 'text-white shadow-md'
          : 'text-gray-500 hover:bg-orange-50 hover:text-gray-900'
        }
        ${collapsed ? 'justify-center px-2' : ''}
      `}
      style={
        active
          ? {
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              boxShadow: '0 4px 14px rgba(249,115,22,0.25)',
            }
          : undefined
      }
    >
      <Icon
        className="shrink-0 transition-all"
        size={18}
        strokeWidth={1.8}
        style={{ color: active ? '#fff' : '#9CA3AF' }}
      />

      {!collapsed && <span className="truncate">{item.label}</span>}

      {/* Active indicator */}
      {active && !collapsed && (
        <ChevronRight size={14} className="ml-auto shrink-0 text-white/80" />
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="
            pointer-events-none absolute left-full z-50 ml-3
            whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium
            opacity-0 shadow-xl transition-opacity
            group-hover:opacity-100
          "
          style={{ background: '#fff', borderColor: BRAND.border, color: BRAND.text }}
        >
          {item.label}
        </div>
      )}
    </Link>
  );
}

// ─── Logout confirmation modal ────────────────────────────────────────────────

function LogoutConfirmModal({
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
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, loading]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        style={{ border: `1px solid ${BRAND.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(249,115,22,0.12)' }}
          >
            <AlertTriangle className="h-5 w-5" style={{ color: BRAND.orange }} />
          </div>
          <div className="min-w-0">
            <h2 id="logout-modal-title" className="text-base font-bold" style={{ color: BRAND.text }}>
              Log out of VendPro?
            </h2>
            <p className="mt-1 text-sm" style={{ color: BRAND.textMuted }}>
              You'll need to log in again to access your wallet and services.
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
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ border: `1.5px solid ${BRAND.border}`, color: BRAND.text }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  collapsed,
  onCollapse,
  onNavigate,
  onLogoutClick,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate?: () => void;
  onLogoutClick: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Logo */}
      <div
        className={`flex items-center border-b px-4 py-5 ${collapsed ? 'justify-center px-2' : 'gap-3'}`}
        style={{ borderColor: BRAND.border }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #F97316, #22C55E)', boxShadow: '0 4px 14px rgba(249,115,22,0.25)' }}
        >
          <Zap size={18} className="text-white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight" style={{ color: BRAND.text }}>VendPro</p>
            <p className="truncate text-xs" style={{ color: BRAND.textFaint }}>Top up in seconds</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p
                className="mb-1.5 px-4 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: BRAND.textFaint }}
              >
                {section.label}
              </p>
            )}
            <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className={`border-t py-4 ${collapsed ? 'px-2' : 'px-3'}`} style={{ borderColor: BRAND.border }}>
       

        <div className="space-y-0.5">
          <button
            className={`
              group flex w-full items-center gap-3 rounded-xl px-3 py-2.5
              text-sm font-medium transition
              ${collapsed ? 'justify-center px-2' : ''}
            `}
            style={{ color: BRAND.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.surface)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Bell size={18} strokeWidth={1.8} className="shrink-0" style={{ color: BRAND.textFaint }} />
            {!collapsed && <span>Notifications</span>}
          </button>

          <button
            onClick={onLogoutClick}
            className={`
              group flex w-full items-center gap-3 rounded-xl px-3 py-2.5
              text-sm font-semibold transition-colors
              ${collapsed ? 'justify-center px-2' : ''}
            `}
            style={{ color: '#DC2626' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#FEF2F2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={18} strokeWidth={1.8} className="shrink-0" style={{ color: '#DC2626' }} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={onCollapse}
        className="hidden border-t py-3 text-center text-xs transition hover:text-gray-700 lg:block"
        style={{ borderColor: BRAND.border, color: BRAND.textFaint }}
      >
        {collapsed ? '→' : '← Collapse'}
      </button>
    </div>
  );
}

// ─── Mobile overlay ───────────────────────────────────────────────────────────

function MobileSidebar({
  open,
  onClose,
  onLogoutClick,
}: {
  open: boolean;
  onClose: () => void;
  onLogoutClick: () => void;
}) {
  // Prevent scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl
          transition-transform duration-300 ease-in-out lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
          style={{ border: `1px solid ${BRAND.border}`, color: BRAND.textMuted }}
        >
          <X size={16} />
        </button>

        <Sidebar collapsed={false} onCollapse={() => {}} onNavigate={onClose} onLogoutClick={onLogoutClick} />
      </aside>
    </>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  // Derive page title from pathname
  const segments = pathname.split('/').filter(Boolean);
  const pageTitle = segments.length > 1
    ? segments[segments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Dashboard';

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/80 px-4 backdrop-blur-md sm:px-6"
      style={{ borderColor: BRAND.border }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-gray-50 lg:hidden"
        style={{ border: `1px solid ${BRAND.border}`, color: BRAND.textMuted }}
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold" style={{ color: BRAND.text }}>{pageTitle}</h1>
        <p className="truncate text-xs" style={{ color: BRAND.textFaint }}>
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-gray-50"
          style={{ border: `1px solid ${BRAND.border}`, color: BRAND.textMuted }}
        >
          <Bell size={17} />
          {/* Unread dot */}
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: BRAND.orange }} />
        </button>

        {/* Avatar */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition hover:opacity-80"
          style={{ background: 'rgba(249,115,22,0.12)', color: BRAND.orange }}
        >
          U
        </button>
      </div>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const router = useRouter();

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to log out. Please try again.');
      }

      setShowLogoutModal(false);
      router.push('/login');
      router.refresh();
    } catch (e: any) {
      setLogoutError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white" style={{ color: BRAND.text }}>
      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`
          hidden flex-col border-r transition-all duration-300 ease-in-out lg:flex
          ${collapsed ? 'w-[68px]' : 'w-64'}
        `}
        style={{ minHeight: '100vh', borderColor: BRAND.border }}
      >
        <Sidebar
          collapsed={collapsed}
          onCollapse={() => setCollapsed(c => !c)}
          onLogoutClick={() => setShowLogoutModal(true)}
        />
      </aside>

      {/* ── Mobile sidebar ─────────────────────────────────────────────────── */}
      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogoutClick={() => { setMobileOpen(false); setShowLogoutModal(true); }}
      />

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-white">
          <div className="min-h-full p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* ── Logout confirmation modal ──────────────────────────────────────── */}
      {showLogoutModal && (
        <LogoutConfirmModal
          onCancel={() => { if (!loggingOut) { setShowLogoutModal(false); setLogoutError(null); } }}
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