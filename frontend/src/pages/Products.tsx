import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Field, inputCls, selectCls, Btn, Modal, Table, Td, EmptyRow, ApiErr } from '../components/ui';

interface Product {
  id: number; sku: string; name: string; description: string | null;
  category: string; unit: string; reorderQty: number; reorderThreshold: number | null;
}

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  reorderQty: z.coerce.number().int().min(0),
  reorderThreshold: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
});
type Fields = z.infer<typeof schema>;
type FErr = Partial<Record<keyof Fields, string>>;

const empty: Fields = { sku: '', name: '', category: '', description: '', unit: 'pcs', reorderQty: 0, reorderThreshold: '' };

export default function Products() {
  const { token } = useAuth();
  const { data: products, loading, error, refetch } = useApi<Product[]>('/products', token);

  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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
  const categories = useMemo(() =>
    [...new Set((products ?? []).map((p) => p.category))].sort(),
    [products]
  );
  const visible = useMemo(() => {
    let list = products ?? [];
    if (needle) list = list.filter((p) => p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle));
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter);
    return list;
  }, [products, needle, categoryFilter]);

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
      const payload = {
        ...parsed.data,
        reorderThreshold: parsed.data.reorderThreshold === '' || parsed.data.reorderThreshold === undefined
          ? null
          : parsed.data.reorderThreshold,
      };
      await apiFetch('/products', { method: 'POST', body: JSON.stringify(payload) }, token);
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

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-64 rounded-lg border border-slate-600 bg-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${selectCls()} w-48`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(query || categoryFilter) && (
          <button onClick={() => { setQuery(''); setCategoryFilter(''); }}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2">
            Clear filters
          </button>
        )}
      </div>

      {error && <ApiErr msg={error} />}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <Table heads={['SKU', 'Name', 'Category', 'Description', 'Unit', 'Reorder Qty', 'Alert Threshold']}>
          {!visible.length
            ? <EmptyRow cols={7} msg={(query || categoryFilter) ? 'No products match your filters' : 'No products yet'} />
            : visible.map((p) => (
              <tr key={p.id} className="hover:bg-slate-700/30">
                <Td><span className="font-mono text-xs text-slate-300">{p.sku}</span></Td>
                <Td className="font-medium text-white">{p.name}</Td>
                <Td><span className="inline-block rounded-full bg-slate-700 px-2.5 py-0.5 text-xs text-slate-300">{p.category}</span></Td>
                <Td className="text-slate-400">{p.description ?? '—'}</Td>
                <Td>{p.unit}</Td>
                <Td>{p.reorderQty}</Td>
                <Td className="text-slate-400">{p.reorderThreshold ?? <span className="text-slate-600">—</span>}</Td>
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
            <Field label="Category" error={fErr.category}>
              <input
                value={fields.category}
                onChange={(e) => set('category', e.target.value)}
                className={inputCls(!!fErr.category)}
                placeholder="e.g. Electronics, Raw Materials…"
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Description" error={fErr.description}>
              <input value={fields.description} onChange={(e) => set('description', e.target.value)} className={inputCls(false)} placeholder="Optional" />
            </Field>
            <Field label="Reorder Qty" error={fErr.reorderQty}>
              <input type="number" min={0} value={fields.reorderQty} onChange={(e) => set('reorderQty', e.target.value)} className={inputCls(!!fErr.reorderQty)} />
            </Field>
            <Field label="Alert Threshold (optional)" error={fErr.reorderThreshold?.toString()}>
              <input
                type="number" min={0}
                value={fields.reorderThreshold ?? ''}
                onChange={(e) => set('reorderThreshold', e.target.value)}
                className={inputCls(false)}
                placeholder="e.g. 5 — triggers low-stock alert"
              />
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
