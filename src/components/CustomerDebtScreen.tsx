import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, ChevronRight, Phone, Receipt, Users, HandCoins } from 'lucide-react';
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

interface OutstandingInvoice {
  id: string;
  invoice_number: number;
  invoice_date: string;
  currency: string;
  remaining: number;
  status: string;
}

interface CustomerDebt {
  customerId: string;
  name: string;
  phone: string | null;
  remainingUSD: number;
  remainingKHR: number;
  invoices: OutstandingInvoice[];
}

interface Props {
  lang: 'KH' | 'EN';
  onBack: () => void;
}

const fmtMoney = (n: number, currency: string) =>
  currency === 'USD'
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ៛`;

export default function CustomerDebtScreen({ lang, onBack }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);

  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [detailTarget, setDetailTarget] = useState<CustomerDebt | null>(null);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, invoice_date, subtotal, discount, paid_amount, status, currency, customer_id, customers(name, phone)'
      )
      .not('customer_id', 'is', null)
      .neq('status', 'paid')
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('Failed to fetch customer debts:', error);
      setDebts([]);
      setLoading(false);
      return;
    }

    const rows = (data as unknown as RawInvoiceRow[]) || [];
    const byCustomer = new Map<string, CustomerDebt>();

    for (const row of rows) {
      if (!row.customer_id || !row.customers) continue;
      const remaining = Number(row.subtotal) - Number(row.discount) - Number(row.paid_amount);
      if (remaining <= 0.005) continue;

      let entry = byCustomer.get(row.customer_id);
      if (!entry) {
        entry = {
          customerId: row.customer_id,
          name: row.customers.name,
          phone: row.customers.phone,
          remainingUSD: 0,
          remainingKHR: 0,
          invoices: [],
        };
        byCustomer.set(row.customer_id, entry);
      }
      if (row.currency === 'USD') entry.remainingUSD += remaining;
      else entry.remainingKHR += remaining;
      entry.invoices.push({
        id: row.id,
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        currency: row.currency,
        remaining,
        status: row.status,
      });
    }

    const list = Array.from(byCustomer.values()).sort(
      (a, b) => b.remainingUSD + b.remainingKHR / 4100 - (a.remainingUSD + a.remainingKHR / 4100)
    );
    setDebts(list);
    setLoading(false);
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
          <p className="text-white font-bold text-base">{tr('អតិថិជនជំពាក់យើង', 'Customers Owe You')}</p>
          <p className="text-white/70 text-xs">{tr('វិក្កយបត្រមិនទាន់សង', 'Outstanding invoice balances')}</p>
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
                {tr('ប្រាក់ជំពាក់សរុប', 'Total owed to you')}
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
            {tr('អតិថិជនម្នាក់ៗ', 'By customer')}
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
                onClick={() => setDetailTarget(d)}
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
                    {d.invoices.length} {tr('វិក្កយបត្រ', 'invoice(s)')}
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
                  {tr('នៅសល់ត្រូវសង', 'Remaining balance')}
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

              <p className="text-sm font-bold mb-2" style={{ color: COLORS.navy }}>
                {tr('វិក្កយបត្រមិនទាន់សងអស់', 'Unpaid invoices')}
              </p>
              <div className="bg-white rounded-2xl py-1" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
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
                    <div className="text-right">
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
