import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import {
  Field, inputCls, selectCls, Btn, Modal, Table, Td, EmptyRow, ApiErr, StatusBadge, StatusSelect, type DocStatus,
} from '../components/ui';

interface Product { id: number; sku: string; name: string; unit: string; }
interface Location { id: number; name: string; warehouse: { name: string }; }
interface DeliveryLine {
  id: number; productId: number; qty: number;
  product: { id: number; sku: string; name: string };
}
interface Delivery {
  id: number; reference: string; customerId: string | null; status: string;
  createdAt: string; createdBy: { name: string }; deliveryLines: DeliveryLine[];
}

const lineSchema = z.object({
  productId: z.coerce.number().int().positive('Select a product'),
  qty: z.coerce.number().int().min(1, 'Min 1'),
});
const createSchema = z.object({
  reference: z.string().min(1, 'Required'),
  customerId: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});
type CreateFields = z.infer<typeof createSchema>;

const validateLineSchema = z.object({
  id: z.number(),
  locationId: z.coerce.number().int().positive('Select a location'),
});
const validateSchema = z.object({ lines: z.array(validateLineSchema) });

const emptyLine = () => ({ productId: 0, qty: 1 });

export default function Deliveries() {
  const { token, user } = useAuth();
  const { data: deliveries, loading, error, refetch } = useApi<Delivery[]>('/deliveries', token);
  const { data: products } = useApi<Product[]>('/products', token);
  const { data: locations } = useApi<Location[]>('/locations', token);

  const [showCreate, setShowCreate] = useState(false);
  const [fields, setFields] = useState<CreateFields>({ reference: '', customerId: '', lines: [emptyLine()] });
  const [apiErr, setApiErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<number, Record<string, string>>>({});

  const [validateTarget, setValidateTarget] = useState<Delivery | null>(null);
  const [vLines, setVLines] = useState<{ id: number; locationId: number }[]>([]);
  const [vErr, setVErr] = useState('');
  const [vSaving, setVSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DocStatus | null>(null);

  function openCreate() {
    setFields({ reference: '', customerId: '', lines: [emptyLine()] });
    setApiErr(''); setLineErrors({}); setShowCreate(true);
  }

  function openValidate(d: Delivery) {
    setValidateTarget(d);
    setVLines(d.deliveryLines.map((l) => ({ id: l.id, locationId: 0 })));
    setVErr('');
  }

  async function handleStatusChange(d: Delivery, next: DocStatus) {
    if (next === 'done') {
      openValidate(d);
      setPendingStatus('done');
      return;
    }
    try {
      await apiFetch(`/deliveries/${d.id}/status`, { method: 'POST', body: JSON.stringify({ status: next }) }, token);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Status update failed');
    }
  }

  function setLine(i: number, k: keyof ReturnType<typeof emptyLine>, v: string) {
    setFields((f) => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [k]: v };
      return { ...f, lines };
    });
  }
  function addLine() { setFields((f) => ({ ...f, lines: [...f.lines, emptyLine()] })); }
  function removeLine(i: number) { setFields((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) })); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setApiErr(''); setLineErrors({});
    const parsed = createSchema.safeParse(fields);
    if (!parsed.success) {
      const errs: Record<number, Record<string, string>> = {};
      parsed.error.issues.forEach((issue) => {
        if (issue.path[0] === 'lines' && typeof issue.path[1] === 'number') {
          const idx = issue.path[1];
          errs[idx] = { ...errs[idx], [issue.path[2] as string]: issue.message };
        }
      });
      setLineErrors(errs);
      if (parsed.error.issues.some((i) => i.path[0] !== 'lines')) setApiErr('Please fix the form errors');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/deliveries', {
        method: 'POST',
        body: JSON.stringify({ ...parsed.data, createdById: user!.id }),
      }, token);
      setShowCreate(false);
      refetch();
    } catch (err) {
      setApiErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setSaving(false); }
  }

  function setVLine(i: number, v: string) {
    setVLines((ls) => ls.map((l, idx) => idx === i ? { ...l, locationId: Number(v) } : l));
    setVErr('');
  }

  async function handleValidate() {
    if (vLines.some((l) => l.locationId === 0)) { setVErr('Select a location for every line'); return; }
    const parsed = validateSchema.safeParse({ lines: vLines });
    if (!parsed.success) { setVErr('Fill in all locations'); return; }
    setVSaving(true);
    const endpoint = pendingStatus === 'done'
      ? `/deliveries/${validateTarget!.id}/status`
      : `/deliveries/${validateTarget!.id}/validate`;
    const body = pendingStatus === 'done'
      ? { status: 'done', lines: parsed.data.lines }
      : { lines: parsed.data.lines };
    try {
      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) }, token);
      setValidateTarget(null);
      setPendingStatus(null);
      refetch();
    } catch (err) {
      setVErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setVSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Deliveries</h1>
        <Btn onClick={openCreate}>+ New Delivery</Btn>
      </div>

      {error && <ApiErr msg={error} />}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
        </div>
      ) : (
        <Table heads={['Reference', 'Customer', 'Lines', 'Status', 'Created', '']}>
          {!deliveries?.length ? <EmptyRow cols={6} msg="No deliveries yet" /> : deliveries.map((d) => (
            <tr key={d.id} className="transition-colors hover:bg-white/[0.02]">
              <Td><span className="font-mono text-xs font-medium text-indigo-300">{d.reference}</span></Td>
              <Td className="text-slate-400">{d.customerId ?? '—'}</Td>
              <Td><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#252d3d] text-xs font-medium text-slate-300">{d.deliveryLines.length}</span></Td>
              <Td><StatusBadge status={d.status} /></Td>
              <Td className="text-slate-500 text-xs">{new Date(d.createdAt).toLocaleDateString()}</Td>
              <Td>
                <StatusSelect status={d.status as DocStatus} onChange={(next) => handleStatusChange(d, next)} />
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <Modal title="New Delivery" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
            {apiErr && <ApiErr msg={apiErr} />}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reference">
                <input value={fields.reference} onChange={(e) => setFields((f) => ({ ...f, reference: e.target.value }))}
                  className={inputCls(false)} placeholder="DEL-001" />
              </Field>
              <Field label="Customer (optional)">
                <input value={fields.customerId ?? ''} onChange={(e) => setFields((f) => ({ ...f, customerId: e.target.value }))}
                  className={inputCls(false)} placeholder="Customer name" />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Lines</span>
                <Btn variant="ghost" onClick={addLine}>+ Add line</Btn>
              </div>
              {fields.lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2 items-start">
                  <div>
                    <select value={line.productId} onChange={(e) => setLine(i, 'productId', e.target.value)} className={selectCls()}>
                      <option value={0}>Select product…</option>
                      {products?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                    {lineErrors[i]?.productId && <p className="text-xs text-red-400 mt-0.5">{lineErrors[i].productId}</p>}
                  </div>
                  <div>
                    <input type="number" min={1} value={line.qty}
                      onChange={(e) => setLine(i, 'qty', e.target.value)}
                      className={inputCls(!!lineErrors[i]?.qty)} placeholder="Qty" />
                    {lineErrors[i]?.qty && <p className="text-xs text-red-400 mt-0.5">{lineErrors[i].qty}</p>}
                  </div>
                  <button type="button" onClick={() => removeLine(i)}
                    className="mt-1 text-slate-500 hover:text-red-400 text-lg leading-none" aria-label="Remove">×</button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Validate Modal ── */}
      {validateTarget && (
        <Modal title={`Validate — ${validateTarget.reference}`} onClose={() => setValidateTarget(null)}>
          <div className="flex flex-col gap-4">
            {vErr && <ApiErr msg={vErr} />}
            <p className="text-sm text-slate-400">Select the source location for each line.</p>
            {validateTarget.deliveryLines.map((line, i) => (
              <div key={line.id} className="flex flex-col gap-3 p-4 rounded-xl border border-[#2a3347] bg-[#1e2536]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">{line.product.name}</span>
                  <span className="text-xs text-slate-500 bg-[#252d3d] px-2 py-0.5 rounded-full">qty: {line.qty}</span>
                </div>
                <Field label="Pick from location">
                  <select value={vLines[i]?.locationId ?? 0}
                    onChange={(e) => setVLine(i, e.target.value)} className={selectCls()}>
                    <option value={0}>Select…</option>
                    {locations?.map((l) => (
                      <option key={l.id} value={l.id}>{l.warehouse.name} — {l.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setValidateTarget(null)}>Cancel</Btn>
              <Btn onClick={handleValidate} disabled={vSaving}>{vSaving ? 'Validating…' : 'Confirm'}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
