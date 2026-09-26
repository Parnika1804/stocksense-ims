import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { ApiErr, selectCls } from '../components/ui';

// ── Types ──────────────────────────────────────────────────────────
interface StockItem {
  quantity: number;
  product: { id: number; name: string; sku: string; category: string; reorderThreshold: number | null };
  location: { id: number; warehouse: { id: number; name: string } };
}
interface Receipt  { id: number; status: string; reference: string; }
interface Delivery { id: number; status: string; reference: string; }
interface Transfer { id: number; }
interface Adjustment { id: number; }
interface Warehouse { id: number; name: string; }

type DocType = 'all' | 'receipts' | 'deliveries' | 'transfers' | 'adjustments';

// ── KPI card ───────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub?: string;
  accent?: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const colors: Record<string, string> = {
    blue:   'border-blue-500/30 bg-blue-500/5',
    green:  'border-green-500/30 bg-green-500/5',
    yellow: 'border-yellow-500/30 bg-yellow-500/5',
    red:    'border-red-500/30 bg-red-500/5',
  };
  const valueColors: Record<string, string> = {
    blue: 'text-blue-400', green: 'text-green-400',
    yellow: 'text-yellow-400', red: 'text-red-400',
  };
  const s = accent ?? 'blue';
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-2 ${colors[s]}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-4xl font-bold tabular-nums ${valueColors[s]}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
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

  const loading = sLoad || rLoad || dLoad || tLoad || aLoad || wLoad;
  const errors  = [sErr, rErr, dErr, tErr, aErr, wErr].filter(Boolean);

  // ── Filter state ──────────────────────────────────────────────
  const [docType, setDocType]  = useState<DocType>('all');
  const [warehouseId, setWHId] = useState('');
  const [category, setCategory] = useState('');

  const hasFilters = docType !== 'all' || warehouseId !== '' || category !== '';

  // Categories derived from stock data
  const categories = useMemo(() =>
    [...new Set((stock ?? []).map((s) => s.product.category))].sort(),
    [stock]
  );

  // ── Filtered stock (warehouse scope) ──────────────────────────
  const filteredStock = useMemo(() => {
    if (!stock) return [];
    return stock.filter((s) => {
      if (warehouseId && s.location.warehouse.id !== Number(warehouseId)) return false;
      if (category && s.product.category !== category) return false;
      return true;
    });
  }, [stock, warehouseId, category]);

  const lowStockItems = useMemo(() =>
    filteredStock.filter((s) => s.quantity < (s.product.reorderThreshold ?? 10)),
    [filteredStock]
  );

  // ── KPI values (document type scope) ─────────────────────────
  const pendingReceipts   = (receipts   ?? []).filter((r) => r.status === 'draft').length;
  const pendingDeliveries = (deliveries ?? []).filter((d) => d.status === 'draft').length;
  const totalTransfers    = transfers?.length   ?? 0;
  const totalAdjustments  = adjustments?.length ?? 0;

  // Which KPI cards to show based on docType filter
  type KpiDef = { label: string; value: number; sub: string; accent: 'green'|'yellow'|'red'|'blue' };
  const kpis = useMemo((): KpiDef[] => {
    const stockCard: KpiDef = {
      label: 'Low Stock', value: lowStockItems.length,
      sub: [
        warehouseId ? `in ${warehouses?.find((w) => w.id === Number(warehouseId))?.name}` : '',
        category ? `cat: ${category}` : '',
        !warehouseId && !category ? 'below reorder threshold' : '',
      ].filter(Boolean).join(' · '),
      accent: lowStockItems.length > 0 ? 'red' : 'green',
    };

    if (docType === 'receipts')
      return [
        stockCard,
        { label: 'Pending Receipts', value: pendingReceipts, sub: 'awaiting validation', accent: pendingReceipts > 0 ? 'yellow' : 'green' },
      ];
    if (docType === 'deliveries')
      return [
        stockCard,
        { label: 'Pending Deliveries', value: pendingDeliveries, sub: 'awaiting validation', accent: pendingDeliveries > 0 ? 'yellow' : 'green' },
      ];
    if (docType === 'transfers')
      return [
        stockCard,
        { label: 'Transfers', value: totalTransfers, sub: 'total recorded', accent: 'blue' },
      ];
    if (docType === 'adjustments')
      return [
        stockCard,
        { label: 'Adjustments', value: totalAdjustments, sub: 'total recorded', accent: 'blue' },
      ];

    // all
    return [
      { label: 'Low Stock', value: lowStockItems.length, sub: stockCard.sub, accent: stockCard.accent },
      { label: 'Pending Receipts',   value: pendingReceipts,   sub: 'awaiting validation', accent: pendingReceipts   > 0 ? 'yellow' : 'green' },
      { label: 'Pending Deliveries', value: pendingDeliveries, sub: 'awaiting validation', accent: pendingDeliveries > 0 ? 'yellow' : 'green' },
      { label: 'Transfers',    value: totalTransfers,   sub: 'total recorded', accent: 'blue' },
      { label: 'Adjustments',  value: totalAdjustments, sub: 'total recorded', accent: 'blue' },
    ];
  }, [docType, lowStockItems, pendingReceipts, pendingDeliveries, totalTransfers, totalAdjustments, warehouseId, category, warehouses]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Welcome back, {user?.name}</p>
      </div>

      {errors.map((e) => <ApiErr key={e} msg={e!} />)}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}
          className={`${selectCls()} w-52`}>
          <option value="all">All document types</option>
          <option value="receipts">Receipts</option>
          <option value="deliveries">Deliveries</option>
          <option value="transfers">Transfers</option>
          <option value="adjustments">Adjustments</option>
        </select>

        <select value={warehouseId} onChange={(e) => setWHId(e.target.value)}
          className={`${selectCls()} w-48`}>
          <option value="">All warehouses</option>
          {(warehouses ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className={`${selectCls()} w-48`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setDocType('all'); setWHId(''); setCategory(''); }}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Low-stock alert banner ── */}
      {!loading && lowStockItems.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-yellow-300">
            ⚠️ {lowStockItems.length} product{lowStockItems.length !== 1 ? 's are' : ' is'} low on stock
            {warehouseId && warehouses && ` in ${warehouses.find((w) => w.id === Number(warehouseId))?.name}`}
            {category && ` · category: ${category}`}
          </p>
          <ul className="flex flex-wrap gap-2">
            {lowStockItems.map((s) => (
              <li key={`${s.product.id}-${s.location.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium border-yellow-500/30 bg-yellow-500/10 text-yellow-200">
                <span className={s.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}>
                  {s.quantity === 0 ? '✕' : s.quantity}
                </span>
                {s.product.name}
                <span className="text-yellow-600 font-mono">{s.product.sku}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── KPIs ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-700 bg-slate-700/20 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 ${kpis.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-5'}`}>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} />
          ))}
        </div>
      )}
    </div>
  );
}
