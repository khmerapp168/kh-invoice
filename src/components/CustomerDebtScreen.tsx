import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ChevronRight, Phone, Receipt, Users, HandCoins, X, CheckCircle2, History } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { IconBadge } from './IconBadge';
import { COLORS, latinFont, INLINE } from '../lib/theme';

interface RawInvoiceRow {
  id: string;
  invoice_number: number;
  invoice_date: string;
  subtotal: number;
  discount: number;
  paid_amount: number;
  status: string;
  currency: string;
  customer_id: string | null;
  customers: { name: string; phone: string | null } | null;
}

interface InvoiceEntry {
  id: string;
  invoice_number: number;
  invoice_date: string;
  currency: string;
  subtotal: number;
  discount: number;
  paid_amount: number;
  remaining: number;
  status: string;
}

interface CustomerDebt {
  customerId: string;
  name: string;
  phone: string | null;
  remainingUSD: number;
  remainingKHR: number;
  // Only the invoices that still have a balance — shown on the
  // "Unpaid" tab and eligible for Record Payment.
  invoices: InvoiceEntry[];
  // Every invoice for this customer, paid or not — the transaction
  // history shown on the "All Transactions" tab.
  allInvoices: InvoiceEntry[];
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

export default function CustomerDebtScreen({ lang, onBack }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);

  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [detailTarget, setDetailTarget] = useState<CustomerDebt | null>(null);
  const [detailTab, setDetailTab] = useState<'unpaid' | 'all'>('unpaid');

  // Record Payment — lets a payment be settled right from this screen
  // instead of having to open the invoice separately.
  const [settleModal, setSettleModal] = useState<InvoiceEntry | null>(null);
  const [settleCustomerName, setSettleCustomerName] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleBusy, setSettleBusy] = useState(false);
  const [settleError, setSettleError] = useState('');

  const fetchDebts = useCallback(async (): Promise<CustomerDebt[]> => {
    setLoading(true);
    // No status filter here — we need every invoice (paid and unpaid)
    // so the "All Transactions" tab can show full customer history,
    // not just what's currently outstanding.
    const { data, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, invoice_date, subtotal, discount, paid_amount, status, currency, customer_id, customers(name, phone)'
      )
      .not('customer_id', 'is', null)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('Failed to fetch customer debts:', error);
      setDebts([]);
      setLoading(false);
      return [];
    }

    const rows = (data as unknown as RawInvoiceRow[]) || [];
    const byCustomer = new Map<string, CustomerDebt>();

    for (const row of rows) {
      if (!row.customer_id || !row.customers) continue;
      const remaining = Number(row.subtotal) - Number(row.discount) - Number(row.paid_amount);

      let entry = byCustomer.get(row.customer_id);
      if (!entry) {
        entry = {
          customerId: row.customer_id,
          name: row.customers.name,
          phone: row.customers.phone,
          remainingUSD: 0,
          remainingKHR: 0,
          invoices: [],
          allInvoices: [],
        };
        byCustomer.set(row.customer_id, entry);
      }

      const invEntry: InvoiceEntry = {
        id: row.id,
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        currency: row.currency,
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        paid_amount: Number(row.paid_amount),
        remaining,
        status: row.status,
      };

      entry.allInvoices.push(invEntry);

      if (remaining > 0.005) {
        if (row.currency === 'USD') entry.remainingUSD += remaining;
        else entry.remainingKHR += remaining;
        entry.invoices.push(invEntry);
      }
    }

    // Only customers who currently have a balance appear on this
    // "Accounts Receivable" screen — a customer with everything paid
    // off has nothing to collect and belongs in the Customer list
    // instead.
    const list = Array.from(byCustomer.values())
      .filter((d) => d.remainingUSD > 0.005 || d.remainingKHR > 0.005)
      .sort((a, b) => b.remainingUSD + b.remainingKHR / 4100 - (a.remainingUSD + a.remainingKHR / 4100));

    setDebts(list);
    setLoading(false);
    return list;
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const totals = useMemo(
    () =>
      debts.reduce(
        (acc, d) => ({ usd: acc.usd + d.remainingUSD, khr: acc.khr + d.remainingKHR }),
        { usd: 0, khr: 0 }
      ),
    [debts]
  );

  const openDetail = (d: CustomerDebt) => {
    setDetailTarget(d);
    setDetailTab('unpaid');
  };

  const openSettle = (inv: InvoiceEntry, customerName: string) => {
    setSettleModal(inv);
    setSettleCustomerName(customerName);
    setSettleAmount(String(inv.remaining.toFixed(2)));
    setSettleError('');
  };

  const handleSettle = async () => {
    if (!settleModal) return;
    setSettleError('');
    const amount = parseFloat(settleAmount) || 0;
    if (amount <= 0) {
      setSettleError(tr('សូមបញ្ចូលចំនួនប្រាក់', 'Please enter an amount'));
      return;
    }
    if (settleModal.paid_amount + amount > settleModal.subtotal - settleModal.discount + 0.005) {
      setSettleError(tr('ចំនួនបានបង់លើសសរុប', 'Paid amount exceeds total'));
      return;
    }
    setSettleBusy(true);

    // Same pattern as the invoice list's Settle feature — insert into
    // the payment ledger and let the database trigger keep
    // invoices.paid_amount / status in sync.
    const { error } = await supabase.from('invoice_payments').insert({
      invoice_id: settleModal.id,
      amount,
      payment_date: new Date().toISOString().slice(0, 10),
    });
    if (error) {
      setSettleBusy(false);
      setSettleError(error.message);
      return;
    }

    // Keep the linked Finance income row (source='invoice') in sync so
    // this payment shows up in Home/Finance/Report without a manual entry.
    const { data: userData } = await supabase.auth.getUser();
    const newPaidTotal = settleModal.paid_amount + amount;
    await supabase.from('transactions').delete().eq('reference_id', settleModal.id).eq('source', 'invoice');
    if (userData.user && newPaidTotal > 0) {
      await supabase.from('transactions').insert({
        user_id: userData.user.id,
        type: 'income',
        transaction_date: new Date().toISOString().slice(0, 10),
        description: `${tr('វិក្កយបត្រ', 'Invoice')} #${settleModal.invoice_number} - ${settleCustomerName}`,
        quantity: 1,
        unit: null,
        unit_price: newPaidTotal,
        currency: settleModal.currency,
        source: 'invoice',
        reference_id: settleModal.id,
      });
    }

    setSettleBusy(false);
    setSettleModal(null);
    setSettleAmount('');

    const refreshed = await fetchDebts();
    // Keep the detail sheet open with fresh numbers, or close it if this
    // customer's balance is now fully settled.
    if (detailTarget) {
      const updated = refreshed.find((d) => d.customerId === detailTarget.customerId);
      setDetailTarget(updated || null);
    }
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
          <p className="text-white font-bold text-base">{tr('ត្រូវទារពីអតិថិជន', 'Accounts Receivable')}</p>
          <p className="text-white/70 text-xs">{tr('សមតុល្យវិក្កយបត្រមិនទាន់សង', 'Outstanding invoice balances')}</p>
        </div>
      </div>

      <div className="app-scroll flex-1 overflow-y-auto p-3.5 pb-8">
        <div className="mx-auto w-full" style={{ maxWidth: 520 }}>
          {/* Summary card */}
          <div
            className="p-4 rounded-2xl mb-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <IconBadge icon={HandCoins} size={INLINE} tint="success" shape="rounded" />
              <p className="text-xs font-semibold" style={{ color: COLORS.muted }}>
                {tr('សរុបប្រាក់ត្រូវទារ', 'Total Receivable')}
              </p>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: COLORS.success, ...latinFont }}>
              ${totals.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {totals.khr > 0 && (
              <p className="text-xs font-semibold mt-0.5" style={{ color: COLORS.muted, ...latinFont }}>
                + {totals.khr.toLocaleString()} ៛
              </p>
            )}
            <p className="text-[11px] mt-1.5" style={{ color: COLORS.muted }}>
              {tr(`អតិថិជន ${debts.length} នាក់ជំពាក់`, `${debts.length} customer${debts.length === 1 ? '' : 's'} with a balance`)}
            </p>
          </div>

          <p className="text-sm font-bold mb-2" style={{ color: COLORS.navy }}>
            {tr('អតិថិជនម្នាក់ៗ', 'By Customer')}
          </p>

          <div className="bg-white rounded-2xl py-1" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
            {loading && (
              <p className="text-xs text-center py-6" style={{ color: COLORS.muted }}>
                {tr('កំពុងផ្ទុក...', 'Loading...')}
              </p>
            )}
            {!loading && debts.length === 0 && (
              <div className="py-10 flex flex-col items-center">
                <IconBadge icon={Users} size={28} tint="success" shape="circle" />
                <p className="text-xs mt-2" style={{ color: COLORS.muted }}>
                  {tr('គ្មានអតិថិជនជំពាក់ទេ', 'No outstanding customer balances')}
                </p>
              </div>
            )}
            {debts.map((d, i) => (
              <button
                key={d.customerId}
                onClick={() => openDetail(d)}
                className="w-full flex items-center px-3.5 py-3 text-left"
                style={{ borderBottom: i < debts.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0"
                  style={{ backgroundColor: COLORS.navyTint }}
                >
                  <span className="text-sm font-bold" style={{ color: COLORS.navy }}>
                    {d.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: COLORS.navy }}>
                    {d.name}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: COLORS.muted }}>
                    {d.invoices.length} {tr('វិក្កយបត្រមិនទាន់សង', 'unpaid invoice(s)')}
                  </p>
                </div>
                <div className="text-right mr-1.5 flex-shrink-0">
                  {d.remainingUSD > 0 && (
                    <p className="text-xs font-bold" style={{ color: COLORS.danger, ...latinFont }}>
                      {fmtMoney(d.remainingUSD, 'USD')}
                    </p>
                  )}
                  {d.remainingKHR > 0 && (
                    <p className="text-[10px] font-semibold" style={{ color: COLORS.danger, ...latinFont }}>
                      {fmtMoney(d.remainingKHR, 'KHR')}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} color={COLORS.muted} strokeWidth={2} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Per-customer detail */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: COLORS.bgApp }}>
          <div
            className="px-4 pt-5 pb-4 flex items-center gap-3 flex-shrink-0"
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
              {detailTarget.phone && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone size={11} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                  <p className="text-white/70 text-xs" style={latinFont}>
                    {detailTarget.phone}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="app-scroll flex-1 overflow-y-auto p-3.5 pb-8">
            <div className="mx-auto w-full" style={{ maxWidth: 520 }}>
              <div
                className="p-4 rounded-2xl mb-3"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
              >
                <p className="text-xs font-semibold" style={{ color: COLORS.muted }}>
                  {tr('សមតុល្យត្រូវទារ', 'Balance Receivable')}
                </p>
                {detailTarget.remainingUSD > 0 && (
                  <p className="text-xl font-extrabold mt-0.5" style={{ color: COLORS.danger, ...latinFont }}>
                    {fmtMoney(detailTarget.remainingUSD, 'USD')}
                  </p>
                )}
                {detailTarget.remainingKHR > 0 && (
                  <p className="text-sm font-bold mt-0.5" style={{ color: COLORS.danger, ...latinFont }}>
                    {fmtMoney(detailTarget.remainingKHR, 'KHR')}
                  </p>
                )}
              </div>

              {/* Tabs — unpaid invoices (with quick Record Payment) vs
                 the customer's full transaction history */}
              <div
                className="flex items-center rounded-full p-0.5 mb-3"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
              >
                <button
                  onClick={() => setDetailTab('unpaid')}
                  className="flex-1 py-2 rounded-full text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: detailTab === 'unpaid' ? COLORS.navy : 'transparent',
                    color: detailTab === 'unpaid' ? '#FFFFFF' : COLORS.muted,
                  }}
                >
                  {tr('មិនទាន់សង', 'Unpaid')}
                </button>
                <button
                  onClick={() => setDetailTab('all')}
                  className="flex-1 py-2 rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1"
                  style={{
                    backgroundColor: detailTab === 'all' ? COLORS.navy : 'transparent',
                    color: detailTab === 'all' ? '#FFFFFF' : COLORS.muted,
                  }}
                >
                  <History size={12} strokeWidth={2.2} />
                  {tr('ប្រតិបត្តិការទាំងអស់', 'All Transactions')}
                </button>
              </div>

              {detailTab === 'unpaid' ? (
                <div className="bg-white rounded-2xl py-1" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                  {detailTarget.invoices.length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: COLORS.muted }}>
                      {tr('គ្មានវិក្កយបត្រនៅសល់ទេ', 'Nothing left unpaid')}
                    </p>
                  )}
                  {detailTarget.invoices.map((inv, i) => (
                    <div
                      key={inv.id}
                      className="flex items-center px-3.5 py-2.5"
                      style={{ borderBottom: i < detailTarget.invoices.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}
                    >
                      <div className="mr-3">
                        <IconBadge icon={Receipt} size={INLINE} tint="invoice" shape="rounded" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: COLORS.navy, ...latinFont }}>
                          #{inv.invoice_number}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: COLORS.muted, ...latinFont }}>
                          {inv.invoice_date}
                        </p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="text-sm font-bold" style={{ color: COLORS.danger, ...latinFont }}>
                          {fmtMoney(inv.remaining, inv.currency)}
                        </p>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: inv.status === 'partial' ? COLORS.goldTint : COLORS.dangerTint,
                            color: inv.status === 'partial' ? COLORS.goldDark : COLORS.danger,
                          }}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <button
                        onClick={() => openSettle(inv, detailTarget.name)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS.successTint }}
                        aria-label={tr('ទូទាត់ប្រាក់', 'Record Payment')}
                      >
                        <HandCoins size={13} color={COLORS.success} strokeWidth={2.2} />
                        <span className="text-[11px] font-bold" style={{ color: COLORS.success }}>
                          {tr('ទូទាត់', 'Pay')}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl py-1" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                  {detailTarget.allInvoices.length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: COLORS.muted }}>
                      {tr('គ្មានប្រតិបត្តិការទេ', 'No transactions yet')}
                    </p>
                  )}
                  {detailTarget.allInvoices.map((inv, i) => (
                    <div
                      key={inv.id}
                      className="flex items-center px-3.5 py-2.5"
                      style={{ borderBottom: i < detailTarget.allInvoices.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}
                    >
                      <div className="mr-3">
                        <IconBadge
                          icon={Receipt}
                          size={INLINE}
                          tint={inv.status === 'paid' ? 'success' : 'invoice'}
                          shape="rounded"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: COLORS.navy, ...latinFont }}>
                          #{inv.invoice_number}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: COLORS.muted, ...latinFont }}>
                          {inv.invoice_date} • {tr('សរុប', 'Total')} {fmtMoney(inv.subtotal - inv.discount, inv.currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-sm font-bold"
                          style={{ color: inv.status === 'paid' ? COLORS.success : COLORS.danger, ...latinFont }}
                        >
                          {inv.status === 'paid'
                            ? fmtMoney(inv.paid_amount, inv.currency)
                            : fmtMoney(inv.remaining, inv.currency)}
                        </p>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor:
                              inv.status === 'paid'
                                ? COLORS.successTint
                                : inv.status === 'partial'
                                ? COLORS.goldTint
                                : COLORS.dangerTint,
                            color: inv.status === 'paid' ? COLORS.success : inv.status === 'partial' ? COLORS.goldDark : COLORS.danger,
                          }}
                        >
                          {inv.status === 'paid' ? tr('បង់រួច', 'paid') : inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment modal */}
      {settleModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] px-4"
          style={{ backgroundColor: 'rgba(18,48,58,0.5)' }}
          onClick={() => setSettleModal(null)}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-bold" style={{ color: COLORS.navy }}>
                {tr('ទូទាត់ប្រាក់', 'Record Payment')}
              </p>
              <button onClick={() => setSettleModal(null)} aria-label="Close">
                <X size={20} color={COLORS.muted} strokeWidth={2} />
              </button>
            </div>

            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: COLORS.bgApp }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: COLORS.muted }}>{tr('វិក្កយបត្រ', 'Invoice')}</span>
                <span className="font-bold" style={{ color: COLORS.invoice, ...latinFont }}>
                  #{String(settleModal.invoice_number).padStart(6, '0')}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: COLORS.muted }}>{tr('សរុប', 'Total')}</span>
                <span className="font-bold" style={{ color: COLORS.navy, ...latinFont }}>
                  {fmtMoney(settleModal.subtotal - settleModal.discount, settleModal.currency)}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: COLORS.muted }}>{tr('បានបង់រួច', 'Already Paid')}</span>
                <span className="font-bold" style={{ color: COLORS.success, ...latinFont }}>
                  {fmtMoney(settleModal.paid_amount, settleModal.currency)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: COLORS.muted }}>{tr('នៅសល់', 'Remaining')}</span>
                <span className="font-bold" style={{ color: COLORS.danger, ...latinFont }}>
                  {fmtMoney(settleModal.remaining, settleModal.currency)}
                </span>
              </div>
            </div>

            <label className="text-xs font-semibold block mb-1" style={{ color: COLORS.navy }}>
              {tr('ចំនួនបង់ថ្មី', 'Payment Amount')}
            </label>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-2"
              style={inputStyle}
            />

            {settleError && (
              <p className="text-xs mb-2" style={{ color: COLORS.danger }}>
                {settleError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSettleAmount(String(settleModal.remaining.toFixed(2)))}
                className="flex-1 py-2.5 rounded-lg border text-xs font-bold"
                style={{ borderColor: COLORS.border, color: COLORS.navy }}
              >
                {tr('បង់ទាំងអស់', 'Pay Full')}
              </button>
              <button
                onClick={handleSettle}
                disabled={settleBusy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-white text-xs disabled:opacity-60"
                style={{ backgroundColor: COLORS.success }}
              >
                <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2} />
                {settleBusy ? tr('កំពុងរក្សា...', 'Saving...') : tr('បញ្ជាក់', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
