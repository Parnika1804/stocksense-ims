import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────
type LeafItem  = { label: string; to: string; icon: ReactIcon };
type GroupItem = { label: string; icon: ReactIcon; children: { label: string; to: string }[] };
type NavItem   = LeafItem | GroupItem;
type ReactIcon = React.ReactNode;

function isGroup(item: NavItem): item is GroupItem {
  return 'children' in item;
}

// ── Icons (inline SVG) ────────────────────────────────────────────
const Icons = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  operations: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3H8l-1 4h10l-1-4z"/>
    </svg>
  ),
  products: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 11h7M7 15h5"/>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  ),
  moves: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10m4 0l-3-3m3 3l-3 3M4 18h7"/>
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  chevronDown: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
    </svg>
  ),
};

// ── Nav definition ────────────────────────────────────────────────
const nav: NavItem[] = [
  { label: 'Dashboard',  to: '/',        icon: Icons.dashboard },
  {
    label: 'Operations', icon: Icons.operations,
    children: [
      { label: 'Receipts',    to: '/receipts' },
      { label: 'Deliveries',  to: '/deliveries' },
      { label: 'Transfers',   to: '/transfers' },
      { label: 'Adjustments', to: '/adjustments' },
    ],
  },
  { label: 'Products',    to: '/products', icon: Icons.products },
  { label: 'Move History', to: '/moves',  icon: Icons.moves },
  { label: 'Settings',    to: '/settings', icon: Icons.settings },
];

// ── Shared link classes ───────────────────────────────────────────
const linkBase =
  'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group';
const linkIdle   = 'text-slate-400 hover:text-slate-100 hover:bg-white/5';
const linkActive = 'text-white bg-indigo-600/15 border-l-2 border-indigo-500 pl-[10px]';

// ── NavGroup ──────────────────────────────────────────────────────
function NavGroup({ item, onClose }: { item: GroupItem; onClose: () => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${linkBase} ${linkIdle} w-full`}
      >
        <span className="text-slate-500">{item.icon}</span>
        <span className="flex-1 text-left text-slate-300">{item.label}</span>
        <span className={`text-slate-600 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}>
          {Icons.chevronDown}
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="ml-4 mt-0.5 mb-1 pl-3 border-l border-[#2a3347] flex flex-col gap-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-150
                 ${isActive
                   ? 'text-indigo-400 font-medium bg-indigo-600/10'
                   : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ProfileMenu ───────────────────────────────────────────────────
function ProfileMenu({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  const initials = user?.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <div className="relative">
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 z-20 bg-[#1e2536] border border-[#2a3347] rounded-xl shadow-2xl overflow-hidden animate-slide-up">
            <NavLink
              to="/profile"
              onClick={() => { setOpen(false); onClose(); }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-slate-100 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="8" r="4"/><path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              My Profile
            </NavLink>
            <div className="border-t border-[#2a3347]" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/8 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
        aria-label="Profile menu"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
          {initials}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </div>
        <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4"/>
        </svg>
      </button>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────
export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />}

      <aside className={`
        fixed inset-y-0 left-0 z-30 flex w-64 flex-col
        bg-[#161b27] border-r border-[#2a3347]
        transform transition-transform duration-250 ease-in-out
        md:static md:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* ── Logo ── */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-[#2a3347] shrink-0">
          {/* SVG Wordmark icon */}
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="26" height="26" rx="7" fill="#6366f1"/>
            <path d="M7 10.5h12M7 13h8M7 15.5h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M16 7l3 3.5-3 3.5" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white font-bold text-base tracking-tight">StockSense</span>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
          {nav.map((item) =>
            isGroup(item) ? (
              <NavGroup key={item.label} item={item} onClose={onClose} />
            ) : (
              <NavLink
                key={(item as LeafItem).to}
                to={(item as LeafItem).to}
                end={(item as LeafItem).to === '/'}
                onClick={onClose}
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                <span className={`transition-colors`}>{(item as LeafItem).icon}</span>
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>

        {/* ── Profile ── */}
        <div className="px-3 pb-4 pt-3 border-t border-[#2a3347] shrink-0">
          <ProfileMenu onClose={onClose} />
        </div>
      </aside>
    </>
  );
}
