import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { ApiErr, Table, Td, EmptyRow } from '../components/ui';

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

function DirectionBadge({ move }: { move: StockMove }) {
  const isIn  = move.toLocation !== null && move.fromLocation === null;
  const isOut = move.fromLocation !== null && move.toLocation === null;
  const both  = move.fromLocation !== null && move.toLocation !== null;

  if (isIn)
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">↓ Incoming</span>;
  if (isOut)
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">↑ Outgoing</span>;
  if (both)
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">⇄ Transfer</span>;
  return <span className="text-slate-500 text-xs">—</span>;
}

export default function MoveHistory() {
  const { token } = useAuth();
  const { data: moves, loading, error } = useApi<StockMove[]>('/stockmoves', token);

  function rowClass(move: StockMove) {
    if (move.toLocation !== null && move.fromLocation === null) return 'hover:bg-green-500/5';
    if (move.fromLocation !== null && move.toLocation === null) return 'hover:bg-red-500/5';
    return 'hover:bg-blue-500/5';
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Move History</h1>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Incoming</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Outgoing</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Transfer</span>
        </div>
      </div>

      {error && <ApiErr msg={error} />}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <Table heads={['Type', 'Product', 'Qty', 'From', 'To', 'Reason', 'Date']}>
          {!moves?.length ? (
            <EmptyRow cols={7} msg="No stock moves yet" />
          ) : (
            moves.map((m) => (
              <tr key={m.id} className={`transition-colors ${rowClass(m)}`}>
                <Td><DirectionBadge move={m} /></Td>
                <Td>
                  <div className="flex flex-col">
                    <span className="text-white font-medium">{m.product.name}</span>
                    <span className="text-xs text-slate-500 font-mono">{m.product.sku}</span>
                  </div>
                </Td>
                <Td>
                  <span className={`font-semibold tabular-nums ${
                    m.toLocation && !m.fromLocation ? 'text-green-400' :
                    m.fromLocation && !m.toLocation ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {m.fromLocation && !m.toLocation ? '−' : '+'}{m.quantity}
                  </span>
                </Td>
                <Td className="text-slate-400">{m.from?.name ?? <span className="text-slate-600">—</span>}</Td>
                <Td className="text-slate-400">{m.to?.name   ?? <span className="text-slate-600">—</span>}</Td>
                <Td className="text-slate-500 text-xs max-w-[180px] truncate">{m.reason ?? '—'}</Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium', timeStyle: 'short',
                  })}
                </Td>
              </tr>
            ))
          )}
        </Table>
      )}
    </div>
  );
}
