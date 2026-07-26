import { useState } from 'react';
import {
  Receipt,
  Wallet,
  Package,
  BarChart3,
  QrCode,
  ChevronRight,
  ChevronLeft,
  X,
  FileDown,
  ArrowDownCircle,
  Lightbulb,
} from 'lucide-react';
import { COLORS } from '../lib/theme';

interface Props {
  lang: 'KH' | 'EN';
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: 'InvoiceOverview' | 'Finance' | 'Stock' | 'Report' | 'Invoice') => void;
}

interface Tip {
  icon: typeof Receipt;
  iconBg: string;
  iconColor: string;
  titleKh: string;
  titleEn: string;
  descKh: string;
  descEn: string;
  stepKh: string;
  stepEn: string;
  ctaScreen?: 'InvoiceOverview' | 'Finance' | 'Stock' | 'Report' | 'Invoice';
  ctaKh: string;
  ctaEn: string;
}

const TIPS: Tip[] = [
  {
    icon: Receipt,
    iconBg: COLORS.invoiceTint,
    iconColor: COLORS.invoice,
    titleKh: 'បង្កើតវិក្កយបត្រ',
    titleEn: 'Create Invoices',
    descKh: 'បង្កើតវិក្កយបត្រដ៏ស្អាត បញ្ចូលទំនិញ និងកំណត់តម្លៃបានយ៉ាងងាយ',
    descEn: 'Build clean invoices — add items and set prices in seconds',
    stepKh: 'ចុចប៊ូតុង "+" ពណ៌ខៀវកណ្ដាល ឬ "វិក្កយបត្រ" នៅផ្ទាំងដើម',
    stepEn: 'Tap the blue "+" button in the middle, or "Invoice" on Home',
    ctaScreen: 'Invoice',
    ctaKh: 'បង្កើតឥឡូវនេះ',
    ctaEn: 'Create now',
  },
  {
    icon: FileDown,
    iconBg: COLORS.invoiceTint,
    iconColor: COLORS.invoice,
    titleKh: 'រក្សាទុកវិក្កយបត្រជា PDF',
    titleEn: 'Save Invoice as PDF',
    descKh: 'ផ្ទាំងមើលវិក្កយបត្រ → ចុច "រក្សាទុក PDF" ដើម្បីទាញយកផ្ទាំងស្អាតផ្ញើរទៅអតិថិជន',
    descEn: 'Preview tab → tap "Save PDF" to download a clean page to send customers',
    stepKh: 'បើកផ្ទាំង "មើល" លើវិក្កយបត្រ ហើយចុចប៊ូតុង "រក្សាទុក PDF"',
    stepEn: 'Open the "Preview" tab on an invoice, then tap "Save PDF"',
    ctaScreen: 'InvoiceOverview',
    ctaKh: 'មើលវិក្កយបត្រ',
    ctaEn: 'View invoices',
  },
  {
    icon: Wallet,
    iconBg: COLORS.successTint,
    iconColor: COLORS.success,
    titleKh: 'តាមដានចំណូល និងចំណាយ',
    titleEn: 'Track Income & Expense',
    descKh: 'កត់ត្រាចំណូល និងចំណាយជារាងរូបិយប័ណ្ណ USD និង KHR បាន',
    descEn: 'Record income and expenses in both USD and KHR currencies',
    stepKh: 'ចុច "ហិរញ្ញវត្ថុ" នៅបារក្រោម រួចចុច "+" ដើម្បីបន្ថែម',
    stepEn: 'Tap "Finance" on the bottom bar, then "+" to add an entry',
    ctaScreen: 'Finance',
    ctaKh: 'ទៅផ្ទាំងហិរញ្ញវត្ថុ',
    ctaEn: 'Go to Finance',
  },
  {
    icon: Package,
    iconBg: COLORS.stockTint,
    iconColor: COLORS.stock,
    titleKh: 'គ្រប់គ្រងស្តុកទំនិញ',
    titleEn: 'Manage Stock',
    descKh: 'បន្ថែមទំនិញ កំណត់តម្លៃលក់ និងព្រមានពេលស្តុកចុះទាប',
    descEn: 'Add products, set sell prices, and get alerted when stock runs low',
    stepKh: 'ចុច "ស្តុក" នៅបារក្រោម រួចចុច "បន្ថែម" ដើម្បីបង្កើតទំនិញ',
    stepEn: 'Tap "Stock" on the bottom bar, then "Add" to create a product',
    ctaScreen: 'Stock',
    ctaKh: 'ទៅផ្ទាំងស្តុក',
    ctaEn: 'Go to Stock',
  },
  {
    icon: ArrowDownCircle,
    iconBg: COLORS.stockTint,
    iconColor: COLORS.stock,
    titleKh: 'បញ្ចូល និងដកស្តុក',
    titleEn: 'Stock In & Out',
    descKh: 'ចុច "ចូល" ពេលទិញបន្ថែម និង "ចេញ" ពេលលក់ ប្រព័ន្ធធ្វើបច្ចុប្បន្នភាពដោយស្វ័យប្រវត្តិ',
    descEn: 'Tap "In" when restocking and "Out" when selling — auto-updates instantly',
    stepKh: 'នៅផ្ទាំងស្តុក ចុច "ចូល" ឬ "ចេញ" នៅក្រោមទំនិញនីមួយៗ',
    stepEn: 'On the Stock screen, tap "In" or "Out" under each product',
    ctaScreen: 'Stock',
    ctaKh: 'ទៅផ្ទាំងស្តុក',
    ctaEn: 'Go to Stock',
  },
  {
    icon: BarChart3,
    iconBg: COLORS.navyTint,
    iconColor: COLORS.navy,
    titleKh: 'មើលរបាយការណ៍',
    titleEn: 'View Reports',
    descKh: 'មើលសង្ខេបទិន្នន័យគ្រប់ផ្នែកតាមខែ ឬឆ្នាំ និងរក្សាទុកជា PDF',
    descEn: 'See a summary of every section by month or year, and save as PDF',
    stepKh: 'ចុច "របាយការណ៍" នៅផ្ទាំងដើមក្រោម "មុខងាររហ័ស"',
    stepEn: 'Tap "Report" on the Home screen under "Quick Actions"',
    ctaScreen: 'Report',
    ctaKh: 'មើលរបាយការណ៍',
    ctaEn: 'View report',
  },
  {
    icon: QrCode,
    iconBg: COLORS.accountTint,
    iconColor: COLORS.account,
    titleKh: 'បង្ហាញ QR ទូទាត់',
    titleEn: 'Show Payment QR',
    descKh: 'បង្ហាញកូដ QR លើវិក្កយបត្រ ដើម្បីអតិថិជនស្កេនបង់ប្រាក់បាន',
    descEn: 'Show a QR code on invoices so customers can scan to pay you',
    stepKh: 'ទៅ "គណនី" → "QR ទូទាត់ប្រាក់" ដើម្បីផ្ទុករូបភាព QR របស់អ្នក',
    stepEn: 'Go to "Account" → "Payment QR Code" to upload your QR image',
    ctaScreen: 'InvoiceOverview',
    ctaKh: 'មើលវិក្កយបត្រ',
    ctaEn: 'View invoices',
  },
];

/**
 * Full-screen, manually-navigated tips guide.
 * Design decisions (per user request):
 *  - Does NOT sit inline on Home anymore, and does NOT auto-play — it only
 *    opens when the user taps the "Tips" entry point, and only moves when
 *    the user taps Next/Prev/a dot. Nothing slides on its own.
 *  - Fills the full viewport (h-[100dvh]) with a solid light background so
 *    it never blends into the navy header/home background.
 */
export default function FeatureBanner({ lang, open, onClose, onNavigate }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);
  const [active, setActive] = useState(0);

  if (!open) return null;

  const tip = TIPS[active];
  const Icon = tip.icon;
  const isFirst = active === 0;
  const isLast = active === TIPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 h-[100dvh] flex flex-col overflow-hidden"
      style={{ backgroundColor: COLORS.bgApp }}
    >
      {/* Header */}
      <div
        className="px-4 pt-4 pb-4 flex items-center justify-between flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})` }}
      >
        <div className="flex items-center gap-2">
          <Lightbulb size={18} color="#FFFFFF" strokeWidth={2} />
          <p className="text-sm font-bold text-white">{tr('គន្លឹះប្រើប្រាស់', 'App Tips')}</p>
        </div>
        <button
          onClick={onClose}
          aria-label={tr('បិទ', 'Close')}
          className="flex items-center justify-center"
          style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <X size={16} color="#FFFFFF" strokeWidth={2.5} />
        </button>
      </div>

      {/* Content — locked in place, no auto movement */}
      <div className="app-scroll flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: tip.iconBg }}
        >
          <Icon size={30} color={tip.iconColor} strokeWidth={2} />
        </div>
        <p className="text-lg font-bold text-center mt-4" style={{ color: COLORS.navy }}>
          {tr(tip.titleKh, tip.titleEn)}
        </p>
        <p className="text-sm text-center leading-relaxed mt-2" style={{ color: COLORS.muted }}>
          {tr(tip.descKh, tip.descEn)}
        </p>
        <div
          className="mt-4 px-4 py-3 rounded-xl text-xs leading-relaxed text-center"
          style={{ backgroundColor: '#FFFFFF', border: `1px solid ${COLORS.border}`, color: COLORS.navy }}
        >
          {tr(tip.stepKh, tip.stepEn)}
        </div>
        {tip.ctaScreen && (
          <button
            onClick={() => {
              onNavigate(tip.ctaScreen!);
              onClose();
            }}
            className="mt-5 inline-flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: COLORS.navy }}
          >
            {tr(tip.ctaKh, tip.ctaEn)}
            <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Manual navigation — dots + prev/next. Nothing moves without a tap. */}
      <div className="flex-shrink-0 px-6 pb-6 pt-2">
        <div className="flex gap-1.5 justify-center mb-4">
          {TIPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Tip ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: active === i ? 18 : 6,
                height: 6,
                backgroundColor: active === i ? COLORS.navy : COLORS.border,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActive((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-bold"
            style={{
              backgroundColor: '#FFFFFF',
              border: `1px solid ${COLORS.border}`,
              color: isFirst ? COLORS.muted : COLORS.navy,
              opacity: isFirst ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
            {tr('មុន', 'Prev')}
          </button>
          <button
            onClick={() => (isLast ? onClose() : setActive((s) => Math.min(TIPS.length - 1, s + 1)))}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: COLORS.navy }}
          >
            {isLast ? tr('រួចរាល់', 'Done') : tr('បន្ទាប់', 'Next')}
            {!isLast && <ChevronRight size={16} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
}
