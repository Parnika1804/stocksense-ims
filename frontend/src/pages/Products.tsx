import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Field, inputCls, selectCls, Btn, Modal, Td, ApiErr } from '../components/ui';

interface Product {
  id: number; sku: string; name: string; description: string | null;
  category: string; unit: string; reorderQty: number; reorderThreshold: number | null;
}
interface Location { id: number; name: string; warehouseId: number; warehouse: { name: string }; }
interface StockEntry {
  quantity: number;
  product: { id: number };
  location: { id: number; name: string; warehouse: { name: string } };
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
  const { token, user } = useAuth();

  // Staff users cannot access this page
  if (user?.role === 'staff') {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-white">Products</h1>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-12 text-center">
          <p className="text-slate-400 text-sm">Managers only.</p>
        </div>
      </div>
    );
  }

  const { data: products, loading, error, refetch } = useApi<Product[]>('/products', token);
  const { data: locations } = useApi<Location[]>('/locations', token);
  const { data: stockData } = useApi<StockEntry[]>('/products/stock', token);

  // ── Filters ────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const needle = query.trim().toLowerCase();
  const categories = useMemo(() =>
    [...new Set((products ?? []).map((p) => p.category))].sort(), [products]
  );
  const visible = useMemo(() => {
    let list = products ?? [];
    if (needle) list = list.filter((p) => p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle));
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter);
    return list;
  }, [products, needle, categoryFilter]);

  // ── Expand state ───────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<number | null>(null);
  function toggleExpand(id: number) { setExpandedId((prev) => prev === id ? null : id); }

  function stockForProduct(productId: number) {
    return (stockData ?? []).filter((s) => s.product.id === productId);
  }

  // ── Form state ─────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [fields, setFields] = useState<Fields>(empty);
  const [fErr, setFErr] = useState<FErr>({});
  const [apiErr, setApiErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Initial stock
  const [initQty, setInitQty] = useState('');
  const [initLocationId, setInitLocationId] = useState('');
  const [initErr, setInitErr] = useState('');

  function set(k: keyof Fields, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
    setFErr((e) => ({ ...e, [k]: undefined }));
    setApiErr('');
  }

  function openForm() {
    setFields(empty); setFErr({}); setApiErr('');
    setInitQty(''); setInitLocationId(''); setInitErr('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInitErr('');
    const parsed = schema.safeParse(fields);
    if (!parsed.success) {
      const errs: FErr = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as keyof Fields] = i.message; });
      setFErr(errs);
      return;
    }

    // Validate initial stock fields if qty is entered
    const qty = initQty.trim() === '' ? 0 : Number(initQty);
    if (initQty.trim() !== '' && qty > 0 && !initLocationId) {
      setInitErr('Select a location for the initial stock');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...parsed.data,
        reorderThreshold: parsed.data.reorderThreshold === '' || parsed.data.reorderThreshold === undefined
          ? null : parsed.data.reorderThreshold,
      };
      const created = await apiFetch<{ id: number }>('/products', { method: 'POST', body: JSON.stringify(payload) }, token);

      // Optional initial stock — direct StockItem upsert via adjustment endpoint
      if (qty > 0 && initLocationId) {
        await apiFetch('/adjustments', {
          method: 'POST',
          body: JSON.stringify({
            productId: created.id,
            locationId: Number(initLocationId),
            countedQuantity: qty,
            reason: 'Initial stock',
          }),
        }, token);
      }

      setShowForm(false);
      refetch();
    } catch (err) {
      setApiErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const COL_COUNT = 9; // SKU Name Category Desc Unit ReorderQty Threshold Expand (8 visible + 1 for expand toggle)

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
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-64 rounded-lg border border-slate-600 bg-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" />
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

      {loading ? <p className="text-slate-400 text-sm">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-300">
            <thead className="bg-slate-700/50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-8"></th>
                {['SKU', 'Name', 'Category', 'Description', 'Unit', 'Reorder Qty', 'Alert Threshold'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {!visible.length ? (
                <tr><td colSpan={COL_COUNT} className="px-4 py-8 text-center text-slate-500">
                  {(query || categoryFilter) ? 'No products match your filters' : 'No products yet'}
                </td></tr>
              ) : visible.map((p) => {
                const isExpanded = expandedId === p.id;
                const stock = stockForProduct(p.id);
                return (
                  <>
                    <tr key={p.id} className="hover:bg-slate-700/30 cursor-pointer" onClick={() => toggleExpand(p.id)}>
                      <Td>
                        <span className="text-slate-500 text-xs select-none">{isExpanded ? '▾' : '▸'}</span>
                      </Td>
                      <Td><span className="font-mono text-xs text-slate-300">{p.sku}</span></Td>
                      <Td className="font-medium text-white">{p.name}</Td>
                      <Td><span className="inline-block rounded-full bg-slate-700 px-2.5 py-0.5 text-xs text-slate-300">{p.category}</span></Td>
                      <Td className="text-slate-400">{p.description ?? '—'}</Td>
                      <Td>{p.unit}</Td>
                      <Td>{p.reorderQty}</Td>
                      <Td className="text-slate-400">{p.reorderThreshold ?? <span className="text-slate-600">—</span>}</Td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-stock`}>
                        <td colSpan={COL_COUNT} className="px-6 pb-4 pt-0 bg-slate-800/60">
                          <div className="pt-3 pb-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Stock by location</p>
                            {stock.length === 0 ? (
                              <p className="text-xs text-slate-600">No stock recorded for this product.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-left pb-1 pr-6 font-medium">Warehouse</th>
                                    <th className="text-left pb-1 pr-6 font-medium">Location</th>
                                    <th className="text-right pb-1 font-medium">Qty</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stock.map((s) => (
                                    <tr key={s.location.id} className="border-t border-slate-700/40">
                                      <td className="py-1 pr-6 text-slate-400">{s.location.warehouse.name}</td>
                                      <td className="py-1 pr-6 text-slate-300">{s.location.name}</td>
                                      <td className={`py-1 text-right font-semibold tabular-nums ${s.quantity === 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {s.quantity}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
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
              <input value={fields.category} onChange={(e) => set('category', e.target.value)}
                className={inputCls(!!fErr.category)} placeholder="e.g. Electronics, Raw Materials…"
                list="category-suggestions" />
              <datalist id="category-suggestions">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Description">
              <input value={fields.description} onChange={(e) => set('description', e.target.value)} className={inputCls(false)} placeholder="Optional" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reorder Qty" error={fErr.reorderQty}>
                <input type="number" min={0} value={fields.reorderQty} onChange={(e) => set('reorderQty', e.target.value)} className={inputCls(!!fErr.reorderQty)} />
              </Field>
              <Field label="Alert Threshold (optional)" error={fErr.reorderThreshold?.toString()}>
                <input type="number" min={0} value={fields.reorderThreshold ?? ''}
                  onChange={(e) => set('reorderThreshold', e.target.value)}
                  className={inputCls(false)} placeholder="e.g. 5" />
              </Field>
            </div>

            {/* Initial stock section */}
            <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Initial stock (optional)</p>
              {initErr && <p className="text-xs text-red-400">{initErr}</p>}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Quantity">
                  <input type="number" min={0} value={initQty}
                    onChange={(e) => { setInitQty(e.target.value); setInitErr(''); }}
                    className={inputCls(false)} placeholder="0" />
                </Field>
                <Field label="Location">
                  <select value={initLocationId} onChange={(e) => { setInitLocationId(e.target.value); setInitErr(''); }}
                    className={selectCls()} disabled={!initQty || Number(initQty) <= 0}>
                    <option value="">Select location…</option>
                    {(locations ?? []).map((l) => (
                      <option key={l.id} value={l.id}>{l.warehouse.name} — {l.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

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
