import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, X, Store, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { IconBadge } from './IconBadge';
import { COLORS, latinFont, INLINE } from '../lib/theme';

interface SupplierDebt {
  id: string;
  supplier_name: string;
  item_description: string | null;
  total_amount: number;
  paid_amount: number;
  currency: string;
  purchase_date: string;
  note: string | null;
}

interface SupplierGroup {
  supplierName: string;
  remainingUSD: number;
  remainingKHR: number;
  items: SupplierDebt[];
}

interface Props {
  lang: 'KH' | 'EN';
  onBack: () => void;
}

const inputStyle: CSSProperties = {
  borderColor: COLORS.border,
  backgroundColor: '#FFFFFF',
  color: COLORS.navy,
};

const fmtMoney = (n: number, currency: string) =>
  currency === 'USD'
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ៛`;

export default function SupplierDebtScreen({ lang, onBack }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);

  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SupplierDebt | null>(null);
  const [formSupplier, setFormSupplier] = useState('');
  const [formItem, setFormItem] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formPaid, setFormPaid] = useState('');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'KHR'>('USD');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formNote, setFormNote] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<SupplierDebt | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('supplier_debts')
      .select('id, supplier_name, item_description, total_amount, paid_amount, currency, purchase_date, note')
      .order('purchase_date', { ascending: false });
    if (error) {
      console.error('Failed to fetch supplier debts:', error);
      setDebts([]);
    } else {
      setDebts((data as SupplierDebt[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const existingSuppliers = useMemo(
    () => Array.from(new Set(debts.map((d) => d.supplier_name))),
    [debts]
  );

  const groups = useMemo<SupplierGroup[]>(() => {
    const map = new Map<string, SupplierGroup>();
    for (const d of debts) {
      const remaining = Number(d.total_amount) - Number(d.paid_amount);
      let g = map.get(d.supplier_name);
      if (!g) {
        g = { supplierName: d.supplier_name, remainingUSD: 0, remainingKHR: 0, items: [] };
        map.set(d.supplier_name, g);
      }
      if (remaining > 0.005) {
        if (d.currency === 'USD') g.remainingUSD += remaining;
        else g.remainingKHR += remaining;
      }
      g.items.push(d);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.remainingUSD + b.remainingKHR / 4100 - (a.remainingUSD + a.remainingKHR / 4100)
    );
  }, [debts]);

  const totals = useMemo(
    () =>
      groups.reduce(
        (acc, g) => ({ usd: acc.usd + g.remainingUSD, khr: acc.khr + g.remainingKHR }),
        { usd: 0, khr: 0 }
      ),
    [groups]
  );

  const openAddForm = (supplierName?: string) => {
    setEditTarget(null);
    setFormSupplier(supplierName || '');
    setFormItem('');
    setFormTotal('');
    setFormPaid('');
    setFormCurrency('USD');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormNote('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (d: SupplierDebt) => {
    setEditTarget(d);
    setFormSupplier(d.supplier_name);
    setFormItem(d.item_description || '');
    setFormTotal(String(d.total_amount));
    setFormPaid(String(d.paid_amount));
    setFormCurrency(d.currency as 'USD' | 'KHR');
    setFormDate(d.purchase_date);
    setFormNote(d.note || '');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!formSupplier.trim()) {
      setFormError(tr('សូមបញ្ចូលឈ្មោះហាង/អ្នកផ្គត់ផ្គង់', 'Please enter a supplier/shop name'));
      return;
    }
    const total = Number(formTotal);
    const paid = Number(formPaid || 0);
    if (!total || total <= 0) {
      setFormError(tr('សូមបញ្ចូលចំនួនទឹកប្រាក់សរុប', 'Please enter a valid total amount'));
      return;
    }
    setFormBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      supplier_name: formSupplier.trim(),
      item_description: formItem.trim() || null,
      total_amount: total,
      paid_amount: paid,
      currency: formCurrency,
      purchase_date: formDate,
      note: formNote.trim() || null,
    };
    if (editTarget) {
      const { error } = await supabase.from('supplier_debts').update(payload).eq('id', editTarget.id);
      setFormBusy(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('supplier_debts')
        .insert({ ...payload, user_id: userData.user?.id });
      setFormBusy(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    }
    setIsFormOpen(false);
    fetchDebts();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    await supabase.from('supplier_debts').delete().eq('id', deleteTarget.id);
    setDeleteBusy(false);
    setDeleteTarget(null);
    fetchDebts();
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.bgApp }}>
      <div
        className="px-4 pt-5 pb-6 flex items-center gap-3 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})` }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <ArrowLeft size={INLINE} color="#FFFFFF" strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base">{tr('ត្រូវសងអ្នកផ្គត់ផ្គង់', 'Accounts Payable')}</p>
          <p className="text-white/70 text-xs">{tr('ការទិញសម្ភារៈ និងបំណុល', 'Purchases & payables')}</p>
        </div>
        <button
          onClick={() => openAddForm()}
          aria-label={tr('បន្ថែម', 'Add')}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <Plus size={INLINE} color="#FFFFFF" strokeWidth={2.4} />
        </button>
      </div>

      <div className="app-scroll flex-1 overflow-y-auto p-3.5 pb-8">
        <div className="mx-auto w-full" style={{ maxWidth: 520 }}>
          <div
            className="p-4 rounded-2xl mb-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <IconBadge icon={Store} size={INLINE} tint="danger" shape="rounded" />
              <p className="text-xs font-semibold" style={{ color: COLORS.muted }}>
                {tr('សរុបប្រាក់ត្រូវសង', 'Total Payable')}
              </p>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: COLORS.danger, ...latinFont }}>
              ${totals.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {totals.khr > 0 && (
              <p className="text-xs font-semibold mt-0.5" style={{ color: COLORS.muted, ...latinFont }}>
                + {totals.khr.toLocaleString()} ៛
              </p>
            )}
            <p className="text-[11px] mt-1.5" style={{ color: COLORS.muted }}>
              {tr(`អ្នកផ្គត់ផ្គង់ ${groups.length} កន្លែង`, `${groups.length} supplier${groups.length === 1 ? '' : 's'}`)}
            </p>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold" style={{ color: COLORS.navy }}>
              {tr('តាមអ្នកផ្គត់ផ្គង់', 'By supplier')}
            </p>
            <button
              onClick={() => openAddForm()}
              className="flex items-center gap-1 text-[11px] font-bold"
              style={{ color: COLORS.gold }}
            >
              <Plus size={13} color={COLORS.gold} strokeWidth={2.5} />
              {tr('ទិញសម្ភារៈថ្មី', 'Add purchase')}
            </button>
          </div>

          <div className="space-y-2.5">
            {loading && (
              <p className="text-xs text-center py-6" style={{ color: COLORS.muted }}>
                {tr('កំពុងផ្ទុក...', 'Loading...')}
              </p>
            )}
            {!loading && groups.length === 0 && (
              <div className="bg-white rounded-2xl py-10 flex flex-col items-center" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                <IconBadge icon={ShoppingBag} size={28} tint="danger" shape="circle" />
                <p className="text-xs mt-2" style={{ color: COLORS.muted }}>
                  {tr('មិនទាន់មានកំណត់ត្រាទិញសម្ភារៈទេ', 'No purchases recorded yet')}
                </p>
              </div>
            )}
            {groups.map((g) => {
              const isOpen = expanded === g.supplierName;
              return (
                <div
                  key={g.supplierName}
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : g.supplierName)}
                    className="w-full flex items-center px-3.5 py-3 text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0"
                      style={{ backgroundColor: COLORS.dangerTint }}
                    >
                      <Store size={17} color={COLORS.danger} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: COLORS.navy }}>
                        {g.supplierName}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: COLORS.muted }}>
                        {g.items.length} {tr('ការទិញ', 'purchase(s)')}
                      </p>
                    </div>
                    <div className="text-right mr-1.5 flex-shrink-0">
                      {g.remainingUSD > 0 && (
                        <p className="text-xs font-bold" style={{ color: COLORS.danger, ...latinFont }}>
                          {fmtMoney(g.remainingUSD, 'USD')}
                        </p>
                      )}
                      {g.remainingKHR > 0 && (
                        <p className="text-[10px] font-semibold" style={{ color: COLORS.danger, ...latinFont }}>
                          {fmtMoney(g.remainingKHR, 'KHR')}
                        </p>
                      )}
                      {g.remainingUSD <= 0.005 && g.remainingKHR <= 0.005 && (
                        <p className="text-[10px] font-bold" style={{ color: COLORS.success }}>
                          {tr('សងអស់ហើយ', 'Settled')}
                        </p>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronUp size={16} color={COLORS.muted} strokeWidth={2} />
                    ) : (
                      <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
                    )}
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      {g.items.map((d) => {
                        const remaining = Number(d.total_amount) - Number(d.paid_amount);
                        return (
                          <div
                            key={d.id}
                            className="flex items-center px-3.5 py-2.5"
                            style={{ borderBottom: `1px solid ${COLORS.border}` }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: COLORS.navy }}>
                                {d.item_description || tr('ទំនិញ', 'Purchase')}
                              </p>
                              <p className="text-[10px] truncate" style={{ color: COLORS.muted, ...latinFont }}>
                                {d.purchase_date} · {tr('សរុប', 'total')} {fmtMoney(Number(d.total_amount), d.currency)} · {tr('បង់', 'paid')}{' '}
                                {fmtMoney(Number(d.paid_amount), d.currency)}
                              </p>
                            </div>
                            <div className="text-right mr-2 flex-shrink-0">
                              <p
                                className="text-xs font-bold"
                                style={{ color: remaining > 0.005 ? COLORS.danger : COLORS.success, ...latinFont }}
                              >
                                {fmtMoney(Math.max(remaining, 0), d.currency)}
                              </p>
                            </div>
                            <button
                              onClick={() => openEditForm(d)}
                              aria-label={tr('កែប្រែ', 'Edit')}
                              className="flex items-center justify-center flex-shrink-0"
                              style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.navyTint }}
                            >
                              <Pencil size={13} color={COLORS.navy} strokeWidth={2} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => openAddForm(g.supplierName)}
                        className="w-full flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold"
                        style={{ color: COLORS.gold }}
                      >
                        <Plus size={13} color={COLORS.gold} strokeWidth={2.5} />
                        {tr('ទិញបន្ថែមពីអ្នកនេះ', 'Add another purchase here')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add / Edit form */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(12,24,38,0.5)' }}
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="bg-white w-full rounded-t-3xl p-4 pb-6 max-h-[88vh] overflow-y-auto"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold" style={{ color: COLORS.navy }}>
                {editTarget ? tr('កែប្រែការទិញ', 'Edit purchase') : tr('ការទិញថ្មី', 'New purchase')}
              </p>
              <button onClick={() => setIsFormOpen(false)} aria-label="Close">
                <X size={20} color={COLORS.muted} strokeWidth={2} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: COLORS.muted }}>
                  {tr('ឈ្មោះហាង / អ្នកផ្គត់ផ្គង់', 'Supplier / shop name')}
                </label>
                <input
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  list="supplier-names"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={inputStyle}
                  placeholder={tr('ឧ. ហាង ក', 'e.g. Shop A')}
                />
                <datalist id="supplier-names">
                  {existingSuppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: COLORS.muted }}>
                  {tr('បានទិញអ្វី', 'What was purchased')}
                </label>
                <input
                  value={formItem}
                  onChange={(e) => setFormItem(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={inputStyle}
                  placeholder={tr('ឧ. សម្ភារៈសាងសង់', 'e.g. Construction materials')}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold mb-1 block" style={{ color: COLORS.muted }}>
                    {tr('ចំនួនសរុប', 'Total amount')}
                  </label>
                  <input
                    value={formTotal}
                    onChange={(e) => setFormTotal(e.target.value)}
                    type="number"
                    inputMode="decimal"
                    className="w-full px-3 py-2.5 rounded-xl border text-sm"
                    style={{ ...inputStyle, ...latinFont }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold mb-1 block" style={{ color: COLORS.muted }}>
                    {tr('បានបង់រួច', 'Already paid')}
                  </label>
                  <input
                    value={formPaid}
                    onChange={(e) => setFormPaid(e.target.value)}
                    type="number"
                    inputMode="decimal"
                    className="w-full px-3 py-2.5 rounded-xl border text-sm"
                    style={{ ...inputStyle, ...latinFont }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold mb-1 block" style={{ color: COLORS.muted }}>
                    {tr('រូបិយប័ណ្ណ', 'Currency')}
                  </label>
                  <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: COLORS.border }}>
                    {(['USD', 'KHR'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setFormCurrency(c)}
                        className="flex-1 py-2.5 text-xs font-bold"
                        style={{
                          backgroundColor: formCurrency === c ? COLORS.navy : '#FFFFFF',
                          color: formCurrency === c ? '#FFFFFF' : COLORS.navy,
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold mb-1 block" style={{ color: COLORS.muted }}>
                    {tr('កាលបរិច្ឆេទ', 'Date')}
                  </label>
                  <input
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    type="date"
                    className="w-full px-3 py-2.5 rounded-xl border text-sm"
                    style={{ ...inputStyle, ...latinFont }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: COLORS.muted }}>
                  {tr('កំណត់ចំណាំ (មិនចាំបាច់)', 'Note (optional)')}
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={inputStyle}
                />
              </div>

              {formError && (
                <p className="text-xs font-semibold" style={{ color: COLORS.danger }}>
                  {formError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                {editTarget && (
                  <button
                    onClick={() => {
                      setIsFormOpen(false);
                      setDeleteTarget(editTarget);
                    }}
                    className="flex items-center justify-center px-4 py-3 rounded-xl border flex-shrink-0"
                    style={{ borderColor: COLORS.dangerTint, backgroundColor: '#FFFFFF' }}
                    aria-label={tr('លុប', 'Delete')}
                  >
                    <Trash2 size={16} color={COLORS.danger} strokeWidth={2} />
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={formBusy}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-60"
                  style={{ backgroundColor: COLORS.navy }}
                >
                  {formBusy ? tr('កំពុងរក្សាទុក...', 'Saving...') : tr('រក្សាទុក', 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(12,24,38,0.5)' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <div
              className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3"
              style={{ backgroundColor: COLORS.dangerTint }}
            >
              <Trash2 size={26} color={COLORS.danger} strokeWidth={2} />
            </div>
            <p className="text-base font-bold mb-1" style={{ color: COLORS.navy }}>
              {tr('លុបកំណត់ត្រានេះ?', 'Delete this record?')}
            </p>
            <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
              {tr('សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។', 'This action cannot be undone.')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-lg font-bold text-sm border"
                style={{ borderColor: COLORS.border, color: COLORS.navy }}
              >
                {tr('បោះបង់', 'Cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBusy}
                className="flex-1 py-3 rounded-lg font-bold text-white text-sm disabled:opacity-60"
                style={{ backgroundColor: COLORS.danger }}
              >
                {deleteBusy ? tr('កំពុងលុប...', 'Deleting...') : tr('លុប', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
