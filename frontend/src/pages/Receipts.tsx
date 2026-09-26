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
interface ReceiptLine {
  id: number; productId: number; expectedQty: number; receivedQty: number;
  product: { id: number; sku: string; name: string };
}
interface Receipt {
  id: number; reference: string; supplierId: string | null; status: string;
  createdAt: string; createdBy: { name: string }; receiptLines: ReceiptLine[];
}

// ── Create schema ──────────────────────────────────────────────────
const lineSchema = z.object({
  productId: z.coerce.number().int().positive('Select a product'),
  expectedQty: z.coerce.number().int().min(1, 'Min 1'),
});
const createSchema = z.object({
  reference: z.string().min(1, 'Required'),
  supplierId: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});
type CreateFields = z.infer<typeof createSchema>;

// ── Validate schema ────────────────────────────────────────────────
const validateLineSchema = z.object({
  id: z.number(),
  receivedQty: z.coerce.number().int().min(0, 'Min 0'),
  locationId: z.coerce.number().int().positive('Select a location'),
});
const validateSchema = z.object({ lines: z.array(validateLineSchema) });

type DraftLine = { productId: number; expectedQty: number };
const emptyLine = (): DraftLine => ({ productId: 0, expectedQty: 1 });

export default function Receipts() {
  const { token, user } = useAuth();
  const { data: receipts, loading, error, refetch } = useApi<Receipt[]>('/receipts', token);
  const { data: products } = useApi<Product[]>('/products', token);
  const { data: locations } = useApi<Location[]>('/locations', token);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [fields, setFields] = useState<CreateFields>({ reference: '', supplierId: '', lines: [emptyLine()] });
  const [apiErr, setApiErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<number, Record<string, string>>>({});

  // validate modal
  const [validateTarget, setValidateTarget] = useState<Receipt | null>(null);
  const [vLines, setVLines] = useState<{ id: number; receivedQty: number; locationId: number }[]>([]);
  const [vErr, setVErr] = useState('');
  const [vSaving, setVSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DocStatus | null>(null);

  function openCreate() {
    setFields({ reference: '', supplierId: '', lines: [emptyLine()] });
    setApiErr(''); setLineErrors({}); setShowCreate(true);
  }

  function openValidate(r: Receipt) {
    setValidateTarget(r);
    setVLines(r.receiptLines.map((l) => ({ id: l.id, receivedQty: l.expectedQty, locationId: 0 })));
    setVErr('');
  }

  async function handleStatusChange(r: Receipt, next: DocStatus) {
    if (next === 'done') {
      // done requires line/location data — open validate modal
      openValidate(r);
      setPendingStatus('done');
      return;
    }
    try {
      await apiFetch(`/receipts/${r.id}/status`, { method: 'POST', body: JSON.stringify({ status: next }) }, token);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Status update failed');
    }
  }

  // ── Create helpers ─────────────────────────────────────────────
  function setLine(i: number, k: keyof DraftLine, v: string) {
    setFields((f) => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [k]: v };
      return { ...f, lines };
    });
  }
  function addLine() { setFields((f) => ({ ...f, lines: [...f.lines, emptyLine()] })); }
  function removeLine(i: number) {
    setFields((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

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
      if (parsed.error.issues.some((i) => i.path[0] !== 'lines')) {
        setApiErr('Please fix the form errors');
      }
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/receipts', {
        method: 'POST',
        body: JSON.stringify({ ...parsed.data, createdById: user!.id }),
      }, token);
      setShowCreate(false);
      refetch();
    } catch (err) {
      setApiErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setSaving(false); }
  }

  // ── Validate helpers ───────────────────────────────────────────
  function setVLine(i: number, k: 'receivedQty' | 'locationId', v: string) {
    setVLines((ls) => ls.map((l, idx) => idx === i ? { ...l, [k]: Number(v) } : l));
    setVErr('');
  }

  async function handleValidate() {
    const parsed = validateSchema.safeParse({ lines: vLines });
    if (!parsed.success) { setVErr('Fill in all locations and quantities'); return; }
    if (vLines.some((l) => l.locationId === 0)) { setVErr('Select a location for every line'); return; }
    setVSaving(true);
    const endpoint = pendingStatus === 'done'
      ? `/receipts/${validateTarget!.id}/status`
      : `/receipts/${validateTarget!.id}/validate`;
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Receipts</h1>
        <Btn onClick={openCreate}>+ New Receipt</Btn>
      </div>

      {error && <ApiErr msg={error} />}

      {loading ? <p className="text-slate-400 text-sm">Loading…</p> : (
        <Table heads={['Reference', 'Supplier', 'Lines', 'Status', 'Created', '']}>
          {!receipts?.length ? <EmptyRow cols={6} msg="No receipts yet" /> : receipts.map((r) => (
            <tr key={r.id} className="hover:bg-slate-700/30">
              <Td className="font-mono text-xs text-slate-200">{r.reference}</Td>
              <Td className="text-slate-400">{r.supplierId ?? '—'}</Td>
              <Td>{r.receiptLines.length}</Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td className="text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</Td>
              <Td>
                <StatusSelect
                  status={r.status as DocStatus}
                  onChange={(next) => handleStatusChange(r, next)}
                />
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <Modal title="New Receipt" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
            {apiErr && <ApiErr msg={apiErr} />}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reference">
                <input value={fields.reference} onChange={(e) => setFields((f) => ({ ...f, reference: e.target.value }))}
                  className={inputCls(false)} placeholder="REC-001" />
              </Field>
              <Field label="Supplier (optional)">
                <input value={fields.supplierId ?? ''} onChange={(e) => setFields((f) => ({ ...f, supplierId: e.target.value }))}
                  className={inputCls(false)} placeholder="Supplier name" />
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
                    <input type="number" min={1} value={line.expectedQty}
                      onChange={(e) => setLine(i, 'expectedQty', e.target.value)}
                      className={inputCls(!!lineErrors[i]?.expectedQty)} placeholder="Qty" />
                    {lineErrors[i]?.expectedQty && <p className="text-xs text-red-400 mt-0.5">{lineErrors[i].expectedQty}</p>}
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
            <p className="text-sm text-slate-400">Enter received quantities and destination locations.</p>
            {validateTarget.receiptLines.map((line, i) => (
              <div key={line.id} className="flex flex-col gap-2 p-3 rounded-lg border border-slate-700 bg-slate-700/30">
                <span className="text-sm font-medium text-white">{line.product.name}
                  <span className="ml-2 text-xs text-slate-400">expected: {line.expectedQty}</span>
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Received Qty">
                    <input type="number" min={0} value={vLines[i]?.receivedQty ?? 0}
                      onChange={(e) => setVLine(i, 'receivedQty', e.target.value)} className={inputCls(false)} />
                  </Field>
                  <Field label="Location">
                    <select value={vLines[i]?.locationId ?? 0}
                      onChange={(e) => setVLine(i, 'locationId', e.target.value)} className={selectCls()}>
                      <option value={0}>Select…</option>
                      {locations?.map((l) => (
                        <option key={l.id} value={l.id}>{l.warehouse.name} — {l.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
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
