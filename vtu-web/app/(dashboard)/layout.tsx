// vtu-web/app/(dashboard)/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
        }
        ${collapsed ? 'justify-center px-2' : ''}
      `}
    >
      <Icon className={`shrink-0 transition-all ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-200'}`} size={18} strokeWidth={1.8} />

      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}

      {/* Active indicator */}
      {active && !collapsed && (
        <ChevronRight size={14} className="ml-auto shrink-0 text-white/70" />
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="
          pointer-events-none absolute left-full z-50 ml-3
          whitespace-nowrap rounded-lg border border-slate-700
          bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100
          opacity-0 shadow-xl transition-opacity
          group-hover:opacity-100
        ">
          {item.label}
        </div>
      )}
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  collapsed,
  onCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex items-center border-b border-slate-800 px-4 py-5 ${collapsed ? 'justify-center px-2' : 'gap-3'}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 shadow-lg shadow-orange-500/30">
          <Zap size={18} className="text-white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white tracking-tight">VendPro</p>
            <p className="truncate text-xs text-slate-500">Top up in seconds</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="mb-1.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
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
      <div className={`border-t border-slate-800 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* Wallet balance pill */}
        {!collapsed && (
          <div className="mb-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Wallet</p>
            <p className="mt-0.5 text-lg font-bold text-white">₦0.00</p>
            <Link
              href="/wallet"
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-400 transition hover:bg-orange-500/25"
            >
              <ArrowLeftRight size={12} />
              Fund wallet
            </Link>
          </div>
        )}

        <div className={`space-y-0.5 ${collapsed ? '' : ''}`}>
          <button
            className={`
              group flex w-full items-center gap-3 rounded-xl px-3 py-2.5
              text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-100
              ${collapsed ? 'justify-center px-2' : ''}
            `}
          >
            <Bell size={18} strokeWidth={1.8} className="shrink-0 text-slate-500 group-hover:text-slate-200" />
            {!collapsed && <span>Notifications</span>}
          </button>

          <button
            className={`
              group flex w-full items-center gap-3 rounded-xl px-3 py-2.5
              text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400
              ${collapsed ? 'justify-center px-2' : ''}
            `}
            onClick={() => async function () {
                const response = await fetch('/api/auth/logout')
                .then(() => console.log('Logged out'))
                .catch((err) => console.error('Logout error:', err));
            }}
          >
            <LogOut size={18} strokeWidth={1.8} className="shrink-0 text-slate-500 group-hover:text-red-400" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={onCollapse}
        className="hidden border-t border-slate-800 py-3 text-center text-xs text-slate-600 transition hover:text-slate-400 lg:block"
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
}: {
  open: boolean;
  onClose: () => void;
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
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-[#0D0F14] shadow-2xl
          transition-transform duration-300 ease-in-out lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition hover:border-slate-700 hover:text-white"
        >
          <X size={16} />
        </button>

        <Sidebar collapsed={false} onCollapse={() => {}} onNavigate={onClose} />
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-800 bg-[#0D0F14]/80 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 text-slate-400 transition hover:border-slate-700 hover:text-white lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-white">{pageTitle}</h1>
        <p className="truncate text-xs text-slate-500">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 text-slate-400 transition hover:border-slate-700 hover:text-white">
          <Bell size={17} />
          {/* Unread dot */}
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-500" />
        </button>

        {/* Avatar */}
        <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-sm font-bold text-orange-400 transition hover:bg-orange-500/25">
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0D11] text-slate-100">
      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`
          hidden flex-col border-r border-slate-800 bg-[#0D0F14]
          transition-all duration-300 ease-in-out lg:flex
          ${collapsed ? 'w-[68px]' : 'w-64'}
        `}
        style={{ minHeight: '100vh' }}
      >
        <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(c => !c)} />
      </aside>

      {/* ── Mobile sidebar ─────────────────────────────────────────────────── */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}