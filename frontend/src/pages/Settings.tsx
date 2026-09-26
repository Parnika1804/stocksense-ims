import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Field, inputCls, selectCls, Btn, ApiErr } from '../components/ui';

interface Location {
  id: number;
  name: string;
  aisle: string | null;
  bay: string | null;
  level: string | null;
}

interface Warehouse {
  id: number;
  name: string;
  address: string | null;
  locations: Location[];
}

// ── Schemas ────────────────────────────────────────────────────────
const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
});
type WFields = z.infer<typeof warehouseSchema>;
type WErrors = Partial<Record<keyof WFields, string>>;

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  warehouseId: z.coerce.number().int().positive('Select a warehouse'),
  aisle: z.string().optional(),
  bay: z.string().optional(),
  level: z.string().optional(),
});
type LFields = z.infer<typeof locationSchema>;
type LErrors = Partial<Record<keyof LFields, string>>;

const emptyW: WFields = { name: '', address: '' };
const emptyL: LFields = { name: '', warehouseId: 0, aisle: '', bay: '', level: '' };

// ── Section wrapper ────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-slate-200 border-b border-slate-700 pb-2">{title}</h2>
      {children}
    </div>
  );
}

export default function Settings() {
  const { token } = useAuth();
  const { data: warehouses, loading: wLoad, error: wErr, refetch: refetchW } =
    useApi<Warehouse[]>('/warehouses', token);

  // ── Warehouse form state ──────────────────────────────────────
  const [wFields, setWFields] = useState<WFields>(emptyW);
  const [wErrors, setWErrors] = useState<WErrors>({});
  const [wApiErr, setWApiErr] = useState('');
  const [wSaving, setWSaving] = useState(false);
  const [wSuccess, setWSuccess] = useState(false);

  function setW(k: keyof WFields, v: string) {
    setWFields((f) => ({ ...f, [k]: v }));
    setWErrors((e) => ({ ...e, [k]: undefined }));
    setWApiErr('');
    setWSuccess(false);
  }

  async function handleWarehouse(e: React.FormEvent) {
    e.preventDefault();
    setWApiErr(''); setWSuccess(false);
    const parsed = warehouseSchema.safeParse(wFields);
    if (!parsed.success) {
      const errs: WErrors = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as keyof WFields] = i.message; });
      setWErrors(errs);
      return;
    }
    setWSaving(true);
    try {
      await apiFetch('/warehouses', { method: 'POST', body: JSON.stringify(parsed.data) }, token);
      setWFields(emptyW);
      setWSuccess(true);
      refetchW();
    } catch (err) {
      setWApiErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setWSaving(false); }
  }

  // ── Location form state ───────────────────────────────────────
  const [lFields, setLFields] = useState<LFields>(emptyL);
  const [lErrors, setLErrors] = useState<LErrors>({});
  const [lApiErr, setLApiErr] = useState('');
  const [lSaving, setLSaving] = useState(false);
  const [lSuccess, setLSuccess] = useState(false);

  function setL(k: keyof LFields, v: string) {
    setLFields((f) => ({ ...f, [k]: v }));
    setLErrors((e) => ({ ...e, [k]: undefined }));
    setLApiErr('');
    setLSuccess(false);
  }

  async function handleLocation(e: React.FormEvent) {
    e.preventDefault();
    setLApiErr(''); setLSuccess(false);
    const parsed = locationSchema.safeParse(lFields);
    if (!parsed.success) {
      const errs: LErrors = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as keyof LFields] = i.message; });
      setLErrors(errs);
      return;
    }
    setLSaving(true);
    try {
      await apiFetch('/locations', { method: 'POST', body: JSON.stringify(parsed.data) }, token);
      setLFields(emptyL);
      setLSuccess(true);
      refetchW(); // warehouses include locations, refetch to update the list
    } catch (err) {
      setLApiErr(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setLSaving(false); }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      {/* ── Create Warehouse ── */}
      <Section title="New Warehouse">
        <form onSubmit={handleWarehouse} noValidate className="flex flex-col gap-4">
          {wApiErr && <ApiErr msg={wApiErr} />}
          {wSuccess && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-400">
              Warehouse created successfully.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" error={wErrors.name}>
              <input
                value={wFields.name}
                onChange={(e) => setW('name', e.target.value)}
                className={inputCls(!!wErrors.name)}
                placeholder="Main Warehouse"
              />
            </Field>
            <Field label="Address (optional)" error={wErrors.address}>
              <input
                value={wFields.address}
                onChange={(e) => setW('address', e.target.value)}
                className={inputCls(false)}
                placeholder="123 Depot Road"
              />
            </Field>
          </div>
          <div>
            <Btn type="submit" disabled={wSaving}>{wSaving ? 'Creating…' : 'Create Warehouse'}</Btn>
          </div>
        </form>
      </Section>

      {/* ── Create Location ── */}
      <Section title="New Location">
        <form onSubmit={handleLocation} noValidate className="flex flex-col gap-4">
          {lApiErr && <ApiErr msg={lApiErr} />}
          {lSuccess && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-400">
              Location created successfully.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Location Name" error={lErrors.name}>
              <input
                value={lFields.name}
                onChange={(e) => setL('name', e.target.value)}
                className={inputCls(!!lErrors.name)}
                placeholder="Rack A-01"
              />
            </Field>
            <Field label="Warehouse" error={lErrors.warehouseId}>
              <select
                value={lFields.warehouseId}
                onChange={(e) => setL('warehouseId', e.target.value)}
                className={selectCls()}
              >
                <option value={0}>Select warehouse…</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Aisle (optional)">
              <input value={lFields.aisle} onChange={(e) => setL('aisle', e.target.value)}
                className={inputCls(false)} placeholder="A" />
            </Field>
            <Field label="Bay (optional)">
              <input value={lFields.bay} onChange={(e) => setL('bay', e.target.value)}
                className={inputCls(false)} placeholder="01" />
            </Field>
            <Field label="Level (optional)">
              <input value={lFields.level} onChange={(e) => setL('level', e.target.value)}
                className={inputCls(false)} placeholder="2" />
            </Field>
          </div>
          <div>
            <Btn type="submit" disabled={lSaving || !warehouses?.length}>
              {lSaving ? 'Creating…' : 'Create Location'}
            </Btn>
          </div>
        </form>
      </Section>

      {/* ── Warehouse & Location List ── */}
      <Section title="Warehouses & Locations">
        {wErr && <ApiErr msg={wErr} />}
        {wLoad ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : !warehouses?.length ? (
          <p className="text-slate-500 text-sm">No warehouses yet. Create one above.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {warehouses.map((w) => (
              <div key={w.id} className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
                {/* Warehouse header */}
                <div className="flex items-start justify-between px-4 py-3 bg-slate-700/40 border-b border-slate-700">
                  <div>
                    <p className="font-medium text-white">{w.name}</p>
                    {w.address && <p className="text-xs text-slate-400 mt-0.5">{w.address}</p>}
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5">
                    {w.locations.length} location{w.locations.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Locations */}
                {w.locations.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-500">No locations yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-700/50">
                    {w.locations.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="text-slate-200 font-medium">{l.name}</span>
                        {(l.aisle || l.bay || l.level) && (
                          <span className="text-xs text-slate-500">
                            {[l.aisle && `Aisle ${l.aisle}`, l.bay && `Bay ${l.bay}`, l.level && `Level ${l.level}`]
                              .filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
