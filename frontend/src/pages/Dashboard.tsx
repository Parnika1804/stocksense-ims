import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { ApiErr, selectCls } from '../components/ui';
import { STATUSES, type DocStatus } from '../components/ui';

// ── Types ──────────────────────────────────────────────────────────
interface StockItem {
  quantity: number;
  product: { id: number; name: string; sku: string; category: string; reorderThreshold: number | null };
  location: { id: number; name: string; warehouse: { id: number; name: string } };
}
interface Receipt     { id: number; status: string; reference: string; }
interface Delivery    { id: number; status: string; reference: string; }
interface Transfer    { id: number; status: string; }
interface Adjustment  { id: number; }
interface Warehouse   { id: number; name: string; }
interface Location    { id: number; name: string; warehouseId: number; }

type DocType = 'all' | 'receipts' | 'deliveries' | 'transfers' | 'adjustments';
type StatusFilter = DocStatus | 'all';

// ── KPI card ───────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub?: string;
  accent?: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const styles: Record<string, { border: string; icon: string; val: string }> = {
    blue:   { border: 'border-indigo-500/20 hover:border-indigo-500/40', icon: 'text-indigo-400', val: 'text-indigo-300' },
    green:  { border: 'border-emerald-500/20 hover:border-emerald-500/40', icon: 'text-emerald-400', val: 'text-emerald-300' },
    yellow: { border: 'border-amber-500/20 hover:border-amber-500/40', icon: 'text-amber-400', val: 'text-amber-300' },
    red:    { border: 'border-red-500/20 hover:border-red-500/40', icon: 'text-red-400', val: 'text-red-300' },
  };
  const s = styles[accent ?? 'blue'];
  return (
    <div className={`rounded-xl border bg-[#161b27] p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in ${s.border}`}>
      <span className={`text-xs font-semibold uppercase tracking-widest ${s.icon}`}>{label}</span>
      <span className={`text-4xl font-bold tabular-nums tracking-tight animate-count ${s.val}`}>{value}</span>
      {sub && <span className="text-xs text-slate-600 leading-relaxed">{sub}</span>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { token, user } = useAuth();

  const { data: stock,       error: sErr, loading: sLoad } = useApi<StockItem[]>('/products/stock', token);
  const { data: receipts,    error: rErr, loading: rLoad } = useApi<Receipt[]>('/receipts', token);
  const { data: deliveries,  error: dErr, loading: dLoad } = useApi<Delivery[]>('/deliveries', token);
  const { data: transfers,   error: tErr, loading: tLoad } = useApi<Transfer[]>('/transfers', token);
  const { data: adjustments, error: aErr, loading: aLoad } = useApi<Adjustment[]>('/adjustments', token);
  const { data: warehouses,  error: wErr, loading: wLoad } = useApi<Warehouse[]>('/warehouses', token);
  const { data: locations,   loading: lLoad } = useApi<Location[]>('/locations', token);

  const loading = sLoad || rLoad || dLoad || tLoad || aLoad || wLoad || lLoad;
  const errors  = [sErr, rErr, dErr, tErr, aErr, wErr].filter(Boolean);

  // ── Filter state ───────────────────────────────────────────────
  const [docType,      setDocType]      = useState<DocType>('all');
  const [warehouseId,  setWHId]         = useState('');
  const [locationId,   setLocationId]   = useState('');
  const [category,     setCategory]     = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const hasFilters = docType !== 'all' || warehouseId !== '' || locationId !== '' || category !== '' || statusFilter !== 'all';

  // When warehouse changes, reset location
  function handleWarehouseChange(v: string) { setWHId(v); setLocationId(''); }

  // Locations belonging to the selected warehouse
  const warehouseLocations = useMemo(() =>
    warehouseId ? (locations ?? []).filter((l) => l.warehouseId === Number(warehouseId)) : [],
    [locations, warehouseId]
  );

  // ── Derived: categories from stock ────────────────────────────
  const categories = useMemo(() =>
    [...new Set((stock ?? []).map((s) => s.product.category))].sort(),
    [stock]
  );

  // ── Filtered stock (warehouse + category) ─────────────────────
  const filteredStock = useMemo(() => {
    if (!stock) return [];
    return stock.filter((s) => {
      if (warehouseId && s.location.warehouse.id !== Number(warehouseId)) return false;
      if (locationId  && s.location.id !== Number(locationId))            return false;
      if (category    && s.product.category !== category)                 return false;
      return true;
    });
  }, [stock, warehouseId, locationId, category]);

  const lowStockItems = useMemo(() =>
    filteredStock.filter((s) => s.quantity < (s.product.reorderThreshold ?? 10)),
    [filteredStock]
  );

  // ── KPI counts (status-filter-aware) ──────────────────────────
  const receiptCount = useMemo(() => {
    const list = receipts ?? [];
    if (statusFilter === 'all') return list.filter((r) => r.status === 'draft').length;
    return list.filter((r) => r.status === statusFilter).length;
  }, [receipts, statusFilter]);

  const deliveryCount = useMemo(() => {
    const list = deliveries ?? [];
    if (statusFilter === 'all') return list.filter((d) => d.status === 'draft').length;
    return list.filter((d) => d.status === statusFilter).length;
  }, [deliveries, statusFilter]);

  const transferCount = useMemo(() => {
    const list = transfers ?? [];
    if (statusFilter === 'all') return list.length;
    return list.filter((t) => t.status === statusFilter).length;
  }, [transfers, statusFilter]);

  // Scheduled = waiting or ready — always live, ignores status filter
  const scheduledTransfers = useMemo(() =>
    (transfers ?? []).filter((t) => t.status === 'waiting' || t.status === 'ready').length,
    [transfers]
  );

  const totalAdjustments = adjustments?.length ?? 0;

  // ── KPI cards ─────────────────────────────────────────────────
  const receiptLabel   = statusFilter === 'all' ? 'Pending Receipts'   : `Receipts · ${statusFilter}`;
  const deliveryLabel  = statusFilter === 'all' ? 'Pending Deliveries'  : `Deliveries · ${statusFilter}`;
  const transferLabel  = statusFilter === 'all' ? 'Transfers'           : `Transfers · ${statusFilter}`;
  const receiptSub     = statusFilter === 'all' ? 'draft — awaiting validation' : `status: ${statusFilter}`;
  const deliverySub    = statusFilter === 'all' ? 'draft — awaiting validation' : `status: ${statusFilter}`;
  const transferSub    = statusFilter === 'all' ? `${scheduledTransfers} scheduled (waiting/ready)` : `status: ${statusFilter}`;

  type KpiDef = { label: string; value: number; sub: string; accent: 'green' | 'yellow' | 'red' | 'blue' };

  const kpis = useMemo((): KpiDef[] => {
    const stockCard: KpiDef = {
      label: 'Low Stock',
      value: lowStockItems.length,
      sub: [
        warehouseId ? `in ${warehouses?.find((w) => w.id === Number(warehouseId))?.name}` : '',
        locationId  ? `loc: ${warehouseLocations.find((l) => l.id === Number(locationId))?.name}` : '',
        category    ? `cat: ${category}` : '',
        !warehouseId && !locationId && !category ? 'below reorder threshold' : '',
      ].filter(Boolean).join(' · '),
      accent: lowStockItems.length > 0 ? 'red' : 'green',
    };

    const rCard: KpiDef = { label: receiptLabel,  value: receiptCount,  sub: receiptSub,  accent: receiptCount  > 0 ? 'yellow' : 'green' };
    const dCard: KpiDef = { label: deliveryLabel, value: deliveryCount, sub: deliverySub, accent: deliveryCount > 0 ? 'yellow' : 'green' };
    const tCard: KpiDef = { label: transferLabel, value: transferCount, sub: transferSub, accent: 'blue' };
    const sCard: KpiDef = { label: 'Scheduled',   value: scheduledTransfers, sub: 'waiting or ready', accent: scheduledTransfers > 0 ? 'yellow' : 'green' };
    const aCard: KpiDef = { label: 'Adjustments', value: totalAdjustments,   sub: 'total recorded',   accent: 'blue' };

    if (docType === 'receipts')    return [stockCard, rCard];
    if (docType === 'deliveries')  return [stockCard, dCard];
    if (docType === 'adjustments') return [stockCard, aCard];
    if (docType === 'transfers')   return [stockCard, tCard, sCard];

    // all
    return [stockCard, rCard, dCard, tCard, sCard, aCard];
  }, [
    docType, lowStockItems, receiptCount, deliveryCount, transferCount,
    scheduledTransfers, totalAdjustments, warehouseId, locationId, category, warehouses, warehouseLocations,
    receiptLabel, deliveryLabel, transferLabel, receiptSub, deliverySub, transferSub,
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back, <span className="text-slate-300">{user?.name}</span></p>
      </div>

      {errors.map((e) => <ApiErr key={e} msg={e!} />)}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl border border-[#2a3347] bg-[#161b27]">
        <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}
          className={`${selectCls()} w-48`}>
          <option value="all">All document types</option>
          <option value="receipts">Receipts</option>
          <option value="deliveries">Deliveries</option>
          <option value="transfers">Transfers</option>
          <option value="adjustments">Adjustments</option>
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={`${selectCls()} w-40`}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <select value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)}
          className={`${selectCls()} w-44`}>
          <option value="">All warehouses</option>
          {(warehouses ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        {warehouseId && (
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
            className={`${selectCls()} w-44`}>
            <option value="">All locations</option>
            {warehouseLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}

        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className={`${selectCls()} w-44`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setDocType('all'); setWHId(''); setLocationId(''); setCategory(''); setStatusFilter('all'); }}
            className="ml-auto text-xs text-slate-500 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg border border-[#2a3347] hover:border-slate-500">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Low-stock alert banner ── */}
      {!loading && lowStockItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5 flex flex-col gap-2.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <p className="text-sm font-medium text-amber-300">
              {lowStockItems.length} product{lowStockItems.length !== 1 ? 's are' : ' is'} low on stock
              {warehouseId && warehouses && ` · ${warehouses.find((w) => w.id === Number(warehouseId))?.name}`}
              {locationId && warehouseLocations.length > 0 && ` · ${warehouseLocations.find((l) => l.id === Number(locationId))?.name}`}
              {category && ` · ${category}`}
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {lowStockItems.map((s) => (
              <li key={`${s.product.id}-${s.location.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                <span className={s.quantity === 0 ? 'text-red-400 font-bold' : 'text-amber-400'}>
                  {s.quantity === 0 ? '✕' : s.quantity}
                </span>
                {s.product.name}
                <span className="text-amber-700 font-mono">{s.product.sku}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── KPIs ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-[#2a3347] h-28 skeleton" />
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 grid-cols-2 ${kpis.length >= 5 ? 'lg:grid-cols-6' : kpis.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} />
          ))}
        </div>
      )}
    </div>
  );
}
