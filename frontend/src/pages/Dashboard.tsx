import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { ApiErr } from '../components/ui';

interface Product { id: number; reorderQty: number; }
interface StockItem {
  quantity: number;
  product: { id: number; name: string; sku: string; reorderThreshold: number | null };
}
interface Receipt { status: string; }
interface Delivery { status: string; }

function KpiCard({
  label, value, sub, accent,
}: {
  label: string; value: number | string; sub?: string; accent?: 'green' | 'yellow' | 'red' | 'blue';
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
  const scheme = accent ?? 'blue';
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-2 ${colors[scheme]}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-4xl font-bold tabular-nums ${valueColors[scheme]}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const { token, user } = useAuth();

  const { data: products,  error: pErr,  loading: pLoad  } = useApi<Product[]>('/products', token);
  const { data: stock,     error: sErr,  loading: sLoad  } = useApi<StockItem[]>('/products/stock', token);
  const { data: receipts,  error: rErr,  loading: rLoad  } = useApi<Receipt[]>('/receipts', token);
  const { data: deliveries,error: dErr,  loading: dLoad  } = useApi<Delivery[]>('/deliveries', token);

  const loading = pLoad || sLoad || rLoad || dLoad;
  const errors  = [pErr, sErr, rErr, dErr].filter(Boolean);

  const totalProducts  = products?.length ?? 0;
  const lowStockItems  = stock?.filter((s) => {
    const threshold = s.product.reorderThreshold ?? 10;
    return s.quantity < threshold;
  }) ?? [];
  const lowStock       = lowStockItems.length;
  const pendingReceipts   = receipts?.filter((r) => r.status === 'draft').length ?? 0;
  const pendingDeliveries = deliveries?.filter((d) => d.status === 'draft').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Welcome back, {user?.name}</p>
      </div>

      {errors.map((e) => <ApiErr key={e} msg={e!} />)}

      {/* Low-stock alert banner */}
      {!loading && lowStockItems.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-yellow-300">
            ⚠️ {lowStockItems.length} product{lowStockItems.length !== 1 ? 's are' : ' is'} low on stock or out of stock
          </p>
          <ul className="flex flex-wrap gap-2">
            {lowStockItems.map((s) => (
              <li key={s.product.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium
                  border-yellow-500/30 bg-yellow-500/10 text-yellow-200">
                <span className={s.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}>
                  {s.quantity === 0 ? '✕' : `${s.quantity}`}
                </span>
                {s.product.name}
                <span className="text-yellow-600 font-mono">{s.product.sku}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-700 bg-slate-700/20 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Products"     value={totalProducts}  sub="in catalogue"           accent="blue"   />
          <KpiCard label="Low Stock"          value={lowStock}       sub="below reorder threshold"   accent={lowStock > 0 ? 'red' : 'green'} />
          <KpiCard label="Pending Receipts"   value={pendingReceipts}   sub="awaiting validation" accent={pendingReceipts > 0 ? 'yellow' : 'green'} />
          <KpiCard label="Pending Deliveries" value={pendingDeliveries} sub="awaiting validation" accent={pendingDeliveries > 0 ? 'yellow' : 'green'} />
        </div>
      )}
    </div>
  );
}
