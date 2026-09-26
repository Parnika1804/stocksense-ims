import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Field, inputCls, selectCls, Btn, ApiErr, Table, Td, EmptyRow } from '../components/ui';

interface Product  { id: number; sku: string; name: string; unit: string; }
interface Location { id: number; name: string; warehouse: { name: string }; }

interface Adjustment {
  id: number;
  previousQuantity: number;
  countedQuantity: number;
  difference: number;
  reason: string | null;
  createdAt: string;
  product:  { id: number; sku: string; name: string };
  location: { id: number; name: string; warehouse: { name: string } };
}

const schema = z.object({
  productId:       z.coerce.number().int().positive('Select a product'),
  locationId:      z.coerce.number().int().positive('Select a location'),
  countedQuantity: z.coerce.number().int().min(0, 'Cannot be negative'),
  reason:          z.string().optional(),
});
type Fields = z.infer<typeof schema>;
type FErrors = Partial<Record<keyof Fields, string>>;

const empty: Fields = { productId: 0, locationId: 0, countedQuantity: 0, reason: '' };

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0)
    return <span className="text-slate-400 tabular-nums">±0</span>;
  if (diff > 0)
    return <span className="text-green-400 font-semibold tabular-nums">+{diff}</span>;
  return <span className="text-red-400 font-semibold tabular-nums">{diff}</span>;
}

export default function Adjustments() {
  const { token } = useAuth();
  const { data: products  } = useApi<Product[]>('/products', token);
  const { data: locations } = useApi<Location[]>('/locations', token);
  const { data: adjustments, loading, error, refetch } =
    useApi<Adjustment[]>('/adjustments', token);

  const [fields, setFields]   = useState<Fields>(empty);
  const [fErrors, setFErrors] = useState<FErrors>({});
  const [apiErr, setApiErr]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [lastResult, setLastResult] = useState<Adjustment | null>(null);

  function set(k: keyof Fields, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
    setFErrors((e) => ({ ...e, [k]: undefined }));
    setApiErr('');
    setLastResult(null);
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
      const result = await apiFetch<Adjustment>(
        '/adjustments',
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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-white">Stock Adjustments</h1>

      {/* ── Form ── */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col gap-5 max-w-2xl">
        <p className="text-sm text-slate-400">
          Enter the physically counted quantity. The system will calculate the difference
          and update stock accordingly.
        </p>

        {apiErr && <ApiErr msg={apiErr} />}

        {/* Success banner */}
        {lastResult && (
          <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${
            lastResult.difference === 0
              ? 'bg-slate-700/40 border-slate-600 text-slate-300'
              : lastResult.difference > 0
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <span className="text-2xl font-bold tabular-nums">
              {lastResult.difference === 0 ? '±0' : lastResult.difference > 0 ? `+${lastResult.difference}` : lastResult.difference}
            </span>
            <div>
              <p className="font-medium">
                {lastResult.difference === 0
                  ? 'No change — stock already matched.'
                  : `Stock ${lastResult.difference > 0 ? 'increased' : 'decreased'} by ${Math.abs(lastResult.difference)} unit${Math.abs(lastResult.difference) !== 1 ? 's' : ''}.`}
              </p>
              <p className="text-xs opacity-70 mt-0.5">
                {lastResult.product.name} @ {lastResult.location.warehouse.name} — {lastResult.location.name}
                &nbsp;·&nbsp;{lastResult.previousQuantity} → {lastResult.countedQuantity}
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
            <Field label="Location" error={fErrors.locationId}>
              <select value={fields.locationId} onChange={(e) => set('locationId', e.target.value)} className={selectCls()}>
                <option value={0}>Select location…</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>{l.warehouse.name} — {l.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Counted Quantity" error={fErrors.countedQuantity}>
              <input
                type="number" min={0}
                value={fields.countedQuantity}
                onChange={(e) => set('countedQuantity', e.target.value)}
                className={inputCls(!!fErrors.countedQuantity)}
              />
            </Field>
            <Field label="Reason (optional)">
              <input
                value={fields.reason}
                onChange={(e) => set('reason', e.target.value)}
                className={inputCls(false)}
                placeholder="Cycle count, damage, etc."
              />
            </Field>
          </div>
          <div>
            <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Submit Adjustment'}</Btn>
          </div>
        </form>
      </div>

      {/* ── History table ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-200">Adjustment History</h2>
        {error && <ApiErr msg={error} />}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <Table heads={['Product', 'Location', 'Before', 'After', 'Difference', 'Reason', 'Date']}>
            {!adjustments?.length ? (
              <EmptyRow cols={7} msg="No adjustments yet" />
            ) : (
              adjustments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-700/30">
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{a.product.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{a.product.sku}</span>
                    </div>
                  </Td>
                  <Td className="text-slate-400 text-xs">
                    {a.location.warehouse.name}<br />
                    <span className="text-slate-300">{a.location.name}</span>
                  </Td>
                  <Td className="tabular-nums text-slate-400">{a.previousQuantity}</Td>
                  <Td className="tabular-nums text-slate-300">{a.countedQuantity}</Td>
                  <Td><DiffBadge diff={a.difference} /></Td>
                  <Td className="text-slate-500 text-xs max-w-[160px] truncate">{a.reason ?? '—'}</Td>
                  <Td className="text-slate-500 text-xs whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
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
