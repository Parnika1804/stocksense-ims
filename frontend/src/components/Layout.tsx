import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const PAGE_TITLES: Record<string, string> = {
  '/':            'Dashboard',
  '/receipts':    'Receipts',
  '/deliveries':  'Deliveries',
  '/transfers':   'Transfers',
  '/adjustments': 'Adjustments',
  '/products':    'Products',
  '/moves':       'Move History',
  '/settings':    'Settings',
  '/profile':     'My Profile',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'StockSense';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* ── Topbar ── */}
        <header className="flex h-14 items-center justify-between gap-4 border-b border-[#2a3347] px-6 shrink-0 bg-[#161b27]">
          <div className="flex items-center gap-3">
            {/* Hamburger (always visible — hidden at md when sidebar is static) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors md:hidden"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 hidden sm:inline">StockSense</span>
              <svg className="w-3.5 h-3.5 text-slate-700 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
              <span className="font-semibold text-slate-100">{pageTitle}</span>
            </div>
          </div>

          {/* Right side — clock / status indicator could go here */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span className="hidden sm:inline">Connected</span>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
