import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Field, inputCls, selectCls, Btn, ApiErr, Table, Td, EmptyRow, StatusSelect, type DocStatus } from '../components/ui';

interface Product  { id: number; sku: string; name: string; unit: string; }
interface Location { id: number; name: string; warehouse: { name: string }; }

interface Transfer {
  id: number;
  quantity: number;
  status: string;
  reason: string | null;
  createdAt: string;
  product:      { id: number; sku: string; name: string };
  fromLocation: { id: number; name: string; warehouse: { name: string } };
  toLocation:   { id: number; name: string; warehouse: { name: string } };
}

const schema = z.object({
  productId:      z.coerce.number().int().positive('Select a product'),
  fromLocationId: z.coerce.number().int().positive('Select a source location'),
  toLocationId:   z.coerce.number().int().positive('Select a destination location'),
  quantity:       z.coerce.number().int().min(1, 'Minimum 1'),
  reason:         z.string().optional(),
}).refine((d) => d.fromLocationId !== d.toLocationId, {
  message: 'Source and destination must be different',
  path: ['toLocationId'],
});

type Fields  = z.infer<typeof schema>;
type FErrors = Partial<Record<keyof Fields, string>>;
const empty: Fields = { productId: 0, fromLocationId: 0, toLocationId: 0, quantity: 1, reason: '' };

export default function Transfers() {
  const { token } = useAuth();
  const { data: products  } = useApi<Product[]>('/products', token);
  const { data: locations } = useApi<Location[]>('/locations', token);
  const { data: transfers, loading, error, refetch } = useApi<Transfer[]>('/transfers', token);

  const [fields, setFields]   = useState<Fields>(empty);
  const [fErrors, setFErrors] = useState<FErrors>({});
  const [apiErr, setApiErr]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [lastResult, setLastResult] = useState<Transfer | null>(null);

  function set(k: keyof Fields, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
    setFErrors((e) => ({ ...e, [k]: undefined }));
    setApiErr('');
    setLastResult(null);
  }

  async function handleStatusChange(t: Transfer, next: DocStatus) {
    try {
      await apiFetch(`/transfers/${t.id}/status`, { method: 'POST', body: JSON.stringify({ status: next }) }, token);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Status update failed');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiErr(''); setLastResult(null);

    const parsed = schema.safeParse(fields);
    if (!parsed.success) {
      const errs: FErrors = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as keyof Fields] = i.message; });
      setFErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch<Transfer>(
        '/transfers',
        { method: 'POST', body: JSON.stringify(parsed.data) },
        token,
      );
      setLastResult(result);
      setFields(empty);
      refetch();
    } catch (err) {
      setApiErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setSaving(false); }
  }

  function locLabel(l: Location) { return `${l.warehouse.name} — ${l.name}`; }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-white">Internal Transfers</h1>

      {/* ── Form ── */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col gap-5 max-w-2xl">
        <p className="text-sm text-slate-400">
          Move stock between locations. The transfer will be blocked if the source
          location does not have enough quantity.
        </p>

        {apiErr && <ApiErr msg={apiErr} />}

        {lastResult && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300 flex items-center gap-3">
            <span className="text-2xl font-bold tabular-nums">⇄</span>
            <div>
              <p className="font-medium">
                Transferred {lastResult.quantity} unit{lastResult.quantity !== 1 ? 's' : ''} of {lastResult.product.name}
              </p>
              <p className="text-xs opacity-70 mt-0.5">
                {locLabel(lastResult.fromLocation)} → {locLabel(lastResult.toLocation)}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Product" error={fErrors.productId}>
              <select value={fields.productId} onChange={(e) => set('productId', e.target.value)} className={selectCls()}>
                <option value={0}>Select product…</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </Field>
            <Field label="Quantity" error={fErrors.quantity}>
              <input
                type="number" min={1}
                value={fields.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                className={inputCls(!!fErrors.quantity)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="From location" error={fErrors.fromLocationId}>
              <select value={fields.fromLocationId} onChange={(e) => set('fromLocationId', e.target.value)} className={selectCls()}>
                <option value={0}>Select source…</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>{locLabel(l)}</option>
                ))}
              </select>
            </Field>
            <Field label="To location" error={fErrors.toLocationId}>
              <select value={fields.toLocationId} onChange={(e) => set('toLocationId', e.target.value)} className={selectCls()}>
                <option value={0}>Select destination…</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>{locLabel(l)}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Reason (optional)">
            <input
              value={fields.reason}
              onChange={(e) => set('reason', e.target.value)}
              className={inputCls(false)}
              placeholder="Replenishment, reorganisation, etc."
            />
          </Field>

          <div>
            <Btn type="submit" disabled={saving}>{saving ? 'Transferring…' : 'Submit Transfer'}</Btn>
          </div>
        </form>
      </div>

      {/* ── History table ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-200">Transfer History</h2>
        {error && <ApiErr msg={error} />}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <Table heads={['Product', 'From', 'To', 'Qty', 'Status', 'Reason', 'Date']}>
            {!transfers?.length ? (
              <EmptyRow cols={7} msg="No transfers yet" />
            ) : (
              transfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-700/30">
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{t.product.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{t.product.sku}</span>
                    </div>
                  </Td>
                  <Td className="text-slate-400 text-xs">
                    <span className="text-slate-500">{t.fromLocation.warehouse.name}</span><br />
                    <span className="text-slate-300">{t.fromLocation.name}</span>
                  </Td>
                  <Td className="text-slate-400 text-xs">
                    <span className="text-slate-500">{t.toLocation.warehouse.name}</span><br />
                    <span className="text-slate-300">{t.toLocation.name}</span>
                  </Td>
                  <Td className="tabular-nums font-semibold text-blue-400">{t.quantity}</Td>
                  <Td>
                    <StatusSelect
                      status={t.status as DocStatus}
                      onChange={(next) => handleStatusChange(t, next)}
                    />
                  </Td>
                  <Td className="text-slate-500 text-xs max-w-[160px] truncate">{t.reason ?? '—'}</Td>
                  <Td className="text-slate-500 text-xs whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </Td>
                </tr>
              ))
            )}
          </Table>
        )}
      </div>
    </div>
  );
}
