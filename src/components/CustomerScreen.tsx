import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Phone,
  MapPin,
  Receipt,
  Users,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { IconBadge } from './IconBadge';
import { COLORS, latinFont, INLINE, ACTION } from '../lib/theme';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: number;
  invoice_date: string;
  subtotal: number;
  discount: number;
  paid_amount: number;
  status: string;
  currency: string;
}

interface Props {
  lang: 'KH' | 'EN';
  onBack: () => void;
  onPickCustomer?: (c: Customer) => void;
}

const inputStyle: CSSProperties = {
  borderColor: COLORS.border,
  backgroundColor: '#FFFFFF',
  color: COLORS.navy,
};

export default function CustomerScreen({ lang, onBack, onPickCustomer }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [detailTarget, setDetailTarget] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, address, note, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch customers:', error);
      setCustomers([]);
    } else {
      setCustomers((data as Customer[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openAddForm = () => {
    setEditTarget(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNote('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (c: Customer) => {
    setEditTarget(c);
    setFormName(c.name);
    setFormPhone(c.phone || '');
    setFormAddress(c.address || '');
    setFormNote(c.note || '');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) {
      setFormError(tr('សូមបញ្ចូលឈ្មោះអតិថិជន', 'Please enter a customer name'));
      return;
    }
    setFormBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    if (editTarget) {
      const { error } = await supabase
        .from('customers')
        .update({
          name: formName.trim(),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          note: formNote.trim() || null,
        })
        .eq('id', editTarget.id);
      setFormBusy(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('customers').insert({
        user_id: userData.user?.id,
        name: formName.trim(),
        phone: formPhone.trim() || null,
        address: formAddress.trim() || null,
        note: formNote.trim() || null,
      });
      setFormBusy(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    }
    setIsFormOpen(false);
    fetchCustomers();
  };

  const openDetail = async (c: Customer) => {
    setDetailTarget(c);
    setInvoicesLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, subtotal, discount, paid_amount, status, currency')
      .eq('customer_id', c.id)
      .order('invoice_date', { ascending: false });
    setInvoicesLoading(false);
    if (error) {
      setInvoices([]);
    } else {
      setInvoices((data as InvoiceRow[]) || []);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    await supabase.from('customers').delete().eq('id', deleteTarget.id);
    setDeleteBusy(false);
    setDeleteTarget(null);
    fetchCustomers();
  };

  const fmtMoney = (n: number, currency: string) =>
    currency === 'USD'
      ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${n.toLocaleString()} ៛`;

  const totalSpent = invoices.reduce((acc, inv) => acc + Number(inv.subtotal) - Number(inv.discount), 0);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.bgApp }}>
      {/* Header */}
      <div
        className="px-4 pt-5 pb-6 flex items-center gap-3"
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
          <p className="text-white font-bold text-base">{tr('អតិថិជន', 'Customers')}</p>
          <p className="text-white/70 text-xs">{tr('គ្រប់គ្រងព័ត៌មានអតិថិជន', 'Manage customer profiles')}</p>
        </div>
        <button
          onClick={openAddForm}
          aria-label={tr('បន្ថែមអតិថិជន', 'Add customer')}
          className="flex items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <Plus size={INLINE} color="#FFFFFF" strokeWidth={2.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3.5 pt-3">
        <div
          className="flex items-center rounded-xl border px-3 py-2.5"
          style={{ borderColor: COLORS.border, backgroundColor: '#FFFFFF' }}
        >
          <Search size={16} color={COLORS.muted} strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('ស្វែងរកឈ្មោះ លេខ អាសយដ្ឋាន...', 'Search name, phone, address...')}
            className="flex-1 ml-2 text-sm outline-none bg-transparent"
            style={{ color: COLORS.navy }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X size={16} color={COLORS.muted} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="relative flex-1 min-h-0">
        <div className="app-scroll h-full overflow-y-auto p-3.5 pb-24 -mt-1">
          {loading && (
            <p className="text-xs text-center py-8" style={{ color: COLORS.muted }}>
              {tr('កំពុងផ្ទុក...', 'Loading...')}
            </p>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12">
              <IconBadge icon={Users} size={ACTION} tint="navy" shape="rounded" className="mx-auto" />
              <p className="text-xs mt-3" style={{ color: COLORS.muted }}>
                {search ? tr('មិនឃើញអតិថិជន', 'No customers found') : tr('មិនទាន់មានអតិថិជននៅឡើយ', 'No customers yet')}
              </p>
              {!search && (
                <button
                  onClick={openAddForm}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: COLORS.gold }}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                  {tr('បន្ថែមអតិថិជន', 'Add Customer')}
                </button>
              )}
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => (onPickCustomer ? onPickCustomer(c) : openDetail(c))}
              className="w-full flex items-center bg-white rounded-2xl px-3.5 py-3 mb-2 text-left"
              style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: COLORS.navyTint }}
              >
                <span className="text-sm font-bold" style={{ color: COLORS.navy }}>
                  {c.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 ml-3">
                <p className="text-sm font-bold truncate" style={{ color: COLORS.navy }}>
                  {c.name}
                </p>
                {c.phone && (
                  <p className="text-xs truncate" style={{ color: COLORS.muted, ...latinFont }}>
                    {c.phone}
                  </p>
                )}
                {c.address && (
                  <p className="text-xs truncate" style={{ color: COLORS.muted }}>
                    {c.address}
                  </p>
                )}
              </div>
              <ChevronRight size={16} color={COLORS.muted} strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>

      {/* Form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 flex items-end z-40" style={{ backgroundColor: 'rgba(24,41,62,0.4)' }}>
          <div
            className="w-full bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: '0 -4px 10px rgba(24,41,62,0.1)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <IconBadge icon={Users} size={INLINE} tint="navy" shape="rounded" />
              <h3 className="text-base font-bold" style={{ color: COLORS.navy }}>
                {editTarget ? tr('កែអតិថិជន', 'Edit Customer') : tr('អតិថិជនថ្មី', 'New Customer')}
              </h3>
            </div>

            <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
              {tr('ឈ្មោះ', 'Name')} *
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={tr('ឧ. សុីលាភ ផាចារ៉ា', 'e.g. Sopheap Pichara')}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-3"
              style={inputStyle}
            />

            <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
              {tr('លេខទូរស័ព្ទ', 'Phone')}
            </label>
            <input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="012 345 678"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-3"
              style={{ ...inputStyle, ...latinFont }}
            />

            <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
              {tr('អាសយដ្ឋាន', 'Address')}
            </label>
            <input
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder={tr('ឧ. ភ្នំពេញ', 'e.g. Phnom Penh')}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-3"
              style={inputStyle}
            />

            <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
              {tr('ចំណាំ', 'Note')}
            </label>
            <textarea
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              rows={2}
              placeholder={tr('ចំណាំបន្ថែម (ស្រេចចិត្ត)', 'Optional note')}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-3 resize-none"
              style={inputStyle}
            />

            {formError && (
              <div
                className="mb-3 p-2.5 rounded-lg border text-xs"
                style={{ backgroundColor: COLORS.dangerTint, borderColor: '#F4A8A0', color: COLORS.danger }}
              >
                {formError}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setIsFormOpen(false)}
                className="flex-1 py-3 rounded-lg font-bold text-sm border"
                style={{ borderColor: COLORS.border, color: COLORS.navy }}
              >
                {tr('បោះបង់', 'Cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={formBusy}
                className="flex-1 py-3 rounded-lg font-bold text-white text-sm disabled:opacity-60"
                style={{ backgroundColor: COLORS.navy }}
              >
                {formBusy ? tr('កំពុងរក្សាទុក...', 'Saving...') : tr('រក្សាទុក', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: COLORS.bgApp }}>
          <div
            className="px-4 pt-5 pb-6 flex items-center gap-3 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})` }}
          >
            <button
              onClick={() => setDetailTarget(null)}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              <ArrowLeft size={INLINE} color="#FFFFFF" strokeWidth={2} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base truncate">{detailTarget.name}</p>
              <p className="text-white/70 text-xs">{tr('ព័ត៌មានអតិថិជន', 'Customer Profile')}</p>
            </div>
            <button
              onClick={() => {
                setDetailTarget(null);
                openEditForm(detailTarget);
              }}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              <Pencil size={INLINE} color="#FFFFFF" strokeWidth={2} />
            </button>
          </div>

          <div className="app-scroll flex-1 overflow-y-auto p-3.5 pb-6">
            {/* Info card */}
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: COLORS.navyTint }}
                >
                  <span className="text-lg font-bold" style={{ color: COLORS.navy }}>
                    {detailTarget.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate" style={{ color: COLORS.navy }}>
                    {detailTarget.name}
                  </p>
                  {detailTarget.phone && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone size={12} color={COLORS.muted} strokeWidth={2} />
                      <p className="text-xs truncate" style={{ color: COLORS.muted, ...latinFont }}>
                        {detailTarget.phone}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {detailTarget.address && (
                <div className="flex items-start gap-2 mb-2">
                  <MapPin size={14} color={COLORS.muted} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
                  <p className="text-xs" style={{ color: COLORS.navy }}>
                    {detailTarget.address}
                  </p>
                </div>
              )}
              {detailTarget.note && (
                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <p className="text-xs" style={{ color: COLORS.muted }}>
                    {detailTarget.note}
                  </p>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-white rounded-xl p-3" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                <IconBadge icon={Receipt} size={INLINE} tint="invoice" shape="rounded" />
                <p className="text-[10px] font-semibold mt-1.5" style={{ color: COLORS.muted }}>
                  {tr('វិក្កយបត្រ', 'Invoices')}
                </p>
                <p className="text-sm font-bold mt-0.5" style={{ color: COLORS.navy, ...latinFont }}>
                  {invoices.length}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                <IconBadge icon={Receipt} size={INLINE} tint="success" shape="rounded" />
                <p className="text-[10px] font-semibold mt-1.5" style={{ color: COLORS.muted }}>
                  {tr('តម្លៃសរុប', 'Total Spent')}
                </p>
                <p className="text-sm font-bold mt-0.5" style={{ color: COLORS.success, ...latinFont }}>
                  ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Purchase history */}
            <p className="text-sm font-bold mt-4 mb-2" style={{ color: COLORS.navy }}>
              {tr('ប្រវត្តិទិញ', 'Purchase History')}
            </p>
            <div className="bg-white rounded-2xl py-1" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
              {invoicesLoading && (
                <p className="text-xs text-center py-4" style={{ color: COLORS.muted }}>
                  {tr('កំពុងផ្ទុក...', 'Loading...')}
                </p>
              )}
              {!invoicesLoading && invoices.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: COLORS.muted }}>
                  {tr('មិនទាន់មានវិក្កយបត្រ', 'No invoices yet')}
                </p>
              )}
              {invoices.map((inv, i) => (
                <div
                  key={inv.id}
                  className="flex items-center px-3.5 py-2.5"
                  style={{ borderBottom: i < invoices.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}
                >
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: COLORS.navy, ...latinFont }}>
                      #{inv.invoice_number}
                    </p>
                    <p className="text-xs" style={{ color: COLORS.muted, ...latinFont }}>
                      {inv.invoice_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: COLORS.navy, ...latinFont }}>
                      {fmtMoney(Number(inv.subtotal) - Number(inv.discount), inv.currency)}
                    </p>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                          inv.status === 'paid' ? COLORS.successTint : inv.status === 'partial' ? COLORS.goldTint : COLORS.dangerTint,
                        color:
                          inv.status === 'paid' ? COLORS.success : inv.status === 'partial' ? COLORS.goldDark : COLORS.danger,
                      }}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setDeleteTarget(detailTarget)}
              className="w-full mt-4 flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm border"
              style={{ borderColor: COLORS.dangerTint, color: COLORS.danger, backgroundColor: '#FFFFFF' }}
            >
              <Trash2 size={16} color={COLORS.danger} strokeWidth={2} />
              {tr('លុបអតិថិជន', 'Delete Customer')}
            </button>
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
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3"
              style={{ backgroundColor: COLORS.dangerTint }}
            >
              <Trash2 size={26} color={COLORS.danger} strokeWidth={2} />
            </div>
            <p className="text-base font-bold mb-1" style={{ color: COLORS.navy }}>
              {tr('លុបអតិថិជន?', 'Delete Customer?')}
            </p>
            <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
              {tr('វិក្កយបត្រដែលបានបង្កើតរួចនឹងនៅដដែល ប៉ុន្តែឈ្មោះអតិថិជននឹងត្រូវបានលុប។', 'Invoices stay, but the customer link is removed.')}
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
