import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { ApiErr, Table, Td, EmptyRow, selectCls } from '../components/ui';

interface StockMove {
  id: number;
  quantity: number;
  reason: string | null;
  createdAt: string;
  fromLocation: number | null;
  toLocation: number | null;
  product: { id: number; sku: string; name: string };
  from: { id: number; name: string } | null;
  to:   { id: number; name: string } | null;
}

type MoveType = 'all' | 'incoming' | 'outgoing' | 'transfer';

function classifyMove(m: StockMove): Exclude<MoveType, 'all'> {
  if (m.toLocation !== null && m.fromLocation === null) return 'incoming';
  if (m.fromLocation !== null && m.toLocation === null) return 'outgoing';
  return 'transfer';
}

function DirectionBadge({ move }: { move: StockMove }) {
  const type = classifyMove(move);
  if (type === 'incoming')
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">↓ Incoming</span>;
  if (type === 'outgoing')
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">↑ Outgoing</span>;
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">⇄ Transfer</span>;
}

export default function MoveHistory() {
  const { token } = useAuth();
  const { data: moves, loading, error } = useApi<StockMove[]>('/stockmoves', token);

  const [typeFilter, setTypeFilter] = useState<MoveType>('all');
  const [productFilter, setProductFilter] = useState('');

  // Unique product list for the dropdown, derived from fetched moves
  const productOptions = useMemo(() => {
    if (!moves) return [];
    const seen = new Map<number, string>();
    moves.forEach((m) => seen.set(m.product.id, m.product.name));
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [moves]);

  const visible = useMemo(() => {
    if (!moves) return [];
    return moves.filter((m) => {
      if (typeFilter !== 'all' && classifyMove(m) !== typeFilter) return false;
      if (productFilter && m.product.id !== Number(productFilter)) return false;
      return true;
    });
  }, [moves, typeFilter, productFilter]);

  function rowClass(move: StockMove) {
    const type = classifyMove(move);
    if (type === 'incoming') return 'hover:bg-emerald-500/5';
    if (type === 'outgoing') return 'hover:bg-red-500/5';
    return 'hover:bg-indigo-500/5';
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Move History</h1>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Incoming</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Outgoing</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Transfer</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl border border-[#2a3347] bg-[#161b27]">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as MoveType)}
          className={`${selectCls()} w-44`}>
          <option value="all">All types</option>
          <option value="incoming">↓ Incoming</option>
          <option value="outgoing">↑ Outgoing</option>
          <option value="transfer">⇄ Transfer</option>
        </select>
        <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
          className={`${selectCls()} w-56`}>
          <option value="">All products</option>
          {productOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        {(typeFilter !== 'all' || productFilter) && (
          <button onClick={() => { setTypeFilter('all'); setProductFilter(''); }}
            className="ml-auto text-xs text-slate-500 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg border border-[#2a3347] hover:border-slate-500">
            Clear filters
          </button>
        )}
      </div>

      {error && <ApiErr msg={error} />}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
        </div>
      ) : (
        <Table heads={['Type', 'Product', 'Qty', 'From', 'To', 'Reason', 'Date']}>
          {!visible.length ? (
            <EmptyRow cols={7} msg={moves?.length ? 'No moves match the current filters' : 'No stock moves yet'} />
          ) : visible.map((m) => (
            <tr key={m.id} className={`transition-colors ${rowClass(m)}`}>
              <Td><DirectionBadge move={m} /></Td>
              <Td>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-100">{m.product.name}</span>
                  <span className="text-xs text-slate-500 font-mono">{m.product.sku}</span>
                </div>
              </Td>
              <Td>
                <span className={`font-semibold tabular-nums ${
                  m.toLocation && !m.fromLocation ? 'text-emerald-400' :
                  m.fromLocation && !m.toLocation ? 'text-red-400' : 'text-indigo-400'
                }`}>
                  {m.fromLocation && !m.toLocation ? '−' : '+'}{m.quantity}
                </span>
              </Td>
              <Td className="text-slate-400 text-sm">{m.from?.name ?? <span className="text-slate-700">—</span>}</Td>
              <Td className="text-slate-400 text-sm">{m.to?.name   ?? <span className="text-slate-700">—</span>}</Td>
              <Td className="text-slate-500 text-xs max-w-[180px] truncate">{m.reason ?? '—'}</Td>
              <Td className="text-slate-500 text-xs whitespace-nowrap">
                {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
