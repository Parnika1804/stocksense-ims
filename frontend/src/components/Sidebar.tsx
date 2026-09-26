import { useState } from 'react';
import { NavLink } from 'react-router-dom';

type LeafItem = { label: string; to: string; icon: string };
type GroupItem = { label: string; icon: string; children: { label: string; to: string }[] };
type NavItem = LeafItem | GroupItem;

function isGroup(item: NavItem): item is GroupItem {
  return 'children' in item;
}

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: '⬛' },
  {
    label: 'Operations',
    icon: '📦',
    children: [
      { label: 'Receipts',    to: '/receipts' },
      { label: 'Deliveries',  to: '/deliveries' },
      { label: 'Transfers',   to: '/transfers' },
      { label: 'Adjustments', to: '/adjustments' },
    ],
  },
  { label: 'Products', to: '/products', icon: '🏷️' },
  { label: 'Move History', to: '/moves', icon: '🔄' },
  { label: 'Settings', to: '/settings', icon: '⚙️' },
];

const linkClass =
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors';
const activeClass = 'bg-blue-600 text-white hover:bg-blue-500';

function NavGroup({ item }: { item: GroupItem }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
      >
        <span>{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        <span className="text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="ml-6 mt-1 flex flex-col gap-1">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 border-r border-slate-700
          transform transition-transform duration-200
          md:static md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-4 border-b border-slate-700 shrink-0">
          <span className="text-blue-400 text-xl">📊</span>
          <span className="text-white font-bold text-lg tracking-tight">StockSense</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {nav.map((item) =>
            isGroup(item) ? (
              <NavGroup key={item.label} item={item} />
            ) : (
              <NavLink
                key={(item as LeafItem).to}
                to={(item as LeafItem).to}
                end={(item as LeafItem).to === '/'}
                className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
                onClick={onClose}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>
      </aside>
    </>
  );
}
