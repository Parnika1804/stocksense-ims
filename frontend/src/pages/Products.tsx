import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Field, inputCls, Btn, Modal, Table, Td, EmptyRow, ApiErr } from '../components/ui';

interface Product {
  id: number; sku: string; name: string; description: string | null;
  unit: string; reorderQty: number;
}

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  reorderQty: z.coerce.number().int().min(0),
});
type Fields = z.infer<typeof schema>;
type FErr = Partial<Record<keyof Fields, string>>;

const empty: Fields = { sku: '', name: '', description: '', unit: 'pcs', reorderQty: 0 };

export default function Products() {
  const { token } = useAuth();
  const { data: products, loading, error, refetch } = useApi<Product[]>('/products', token);

  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [fields, setFields] = useState<Fields>(empty);
  const [fErr, setFErr] = useState<FErr>({});
  const [apiErr, setApiErr] = useState('');
  const [saving, setSaving] = useState(false);

  function set(k: keyof Fields, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
    setFErr((e) => ({ ...e, [k]: undefined }));
    setApiErr('');
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? (products ?? []).filter(
        (p) => p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)
      )
    : (products ?? []);

  function openForm() { setFields(empty); setFErr({}); setApiErr(''); setShowForm(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(fields);
    if (!parsed.success) {
      const errs: FErr = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as keyof Fields] = i.message; });
      setFErr(errs);
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/products', { method: 'POST', body: JSON.stringify(parsed.data) }, token);
      setShowForm(false);
      refetch();
    } catch (err) {
      setApiErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Products</h1>
        <Btn onClick={openForm}>+ New Product</Btn>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU…"
          className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        />
      </div>

      {error && <ApiErr msg={error} />}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <Table heads={['SKU', 'Name', 'Description', 'Unit', 'Reorder Qty']}>
          {!visible.length
            ? <EmptyRow cols={5} msg={query ? 'No products match your search' : 'No products yet'} />
            : visible.map((p) => (
              <tr key={p.id} className="hover:bg-slate-700/30">
                <Td><span className="font-mono text-xs text-slate-300">{p.sku}</span></Td>
                <Td className="font-medium text-white">{p.name}</Td>
                <Td className="text-slate-400">{p.description ?? '—'}</Td>
                <Td>{p.unit}</Td>
                <Td>{p.reorderQty}</Td>
              </tr>
            ))
          }
        </Table>
      )}

      {showForm && (
        <Modal title="New Product" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {apiErr && <ApiErr msg={apiErr} />}
            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU" error={fErr.sku}>
                <input value={fields.sku} onChange={(e) => set('sku', e.target.value)} className={inputCls(!!fErr.sku)} placeholder="PROD-001" />
              </Field>
              <Field label="Unit" error={fErr.unit}>
                <input value={fields.unit} onChange={(e) => set('unit', e.target.value)} className={inputCls(!!fErr.unit)} placeholder="pcs" />
              </Field>
            </div>
            <Field label="Name" error={fErr.name}>
              <input value={fields.name} onChange={(e) => set('name', e.target.value)} className={inputCls(!!fErr.name)} placeholder="Product name" />
            </Field>
            <Field label="Description" error={fErr.description}>
              <input value={fields.description} onChange={(e) => set('description', e.target.value)} className={inputCls(false)} placeholder="Optional" />
            </Field>
            <Field label="Reorder Qty" error={fErr.reorderQty}>
              <input type="number" min={0} value={fields.reorderQty} onChange={(e) => set('reorderQty', e.target.value)} className={inputCls(!!fErr.reorderQty)} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
