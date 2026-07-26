import { useState, useEffect, useCallback } from 'react';
import { Receipt, Wallet, Package, BarChart3 } from 'lucide-react';
import { COLORS } from '../lib/theme';

interface Props {
  lang: 'KH' | 'EN';
}

interface Slide {
  icon: typeof Receipt;
  titleKh: string;
  titleEn: string;
  descKh: string;
  descEn: string;
}

const SLIDES: Slide[] = [
  {
    icon: Receipt,
    titleKh: 'បង្កើតវិក្កយបត្រយ៉ាងលឿន',
    titleEn: 'Create invoices in seconds',
    descKh: 'រចនាវិក្កយបត្រដ៏ស្អាត ផ្ញើអតិថិជនបានភ្លាមៗ',
    descEn: 'Clean, professional invoices ready to send',
  },
  {
    icon: Wallet,
    titleKh: 'តាមដានចំណូល-ចំណាយ',
    titleEn: 'Track income & expenses',
    descKh: 'គ្រប់គ្រងលុយជា USD និង KHR ក្នុងកន្លែងតែមួយ',
    descEn: 'Manage USD and KHR cash flow in one place',
  },
  {
    icon: Package,
    titleKh: 'គ្រប់គ្រងស្តុកទំនិញ',
    titleEn: 'Stay on top of your stock',
    descKh: 'ដឹងស្តុកនៅសល់ និងទំនិញលក់ដាច់ភ្លាមៗ',
    descEn: 'Real-time stock levels and low-stock alerts',
  },
  {
    icon: BarChart3,
    titleKh: 'របាយការណ៍ច្បាស់លាស់',
    titleEn: 'Clear business reports',
    descKh: 'មើលទិន្នន័យអាជីវកម្មរបស់អ្នកគ្រប់ពេលវេលា',
    descEn: 'Understand your business at a glance',
  },
];

const AUTOPLAY_MS = 3200;

export default function AuthFeatureCarousel({ lang }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);
  const [active, setActive] = useState(0);

  const next = useCallback(() => {
    setActive((s) => (s + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    const t = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [next]);

  const slide = SLIDES[active];
  const Icon = slide.icon;

  return (
    <div
      className="w-full max-w-sm rounded-2xl overflow-hidden relative mt-4"
      style={{
        background: `linear-gradient(135deg, ${COLORS.navyGradientStart} 0%, ${COLORS.navyGradientEnd} 100%)`,
        boxShadow: '0 6px 18px rgba(12,68,124,0.16)',
      }}
    >
      {/* Decorative glow — echoes the home-dashboard banner */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{ width: 110, height: 110, top: -35, right: -25, background: 'rgba(255,255,255,0.07)' }}
      />

      <div className="flex items-center gap-3 px-4 py-3.5 relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
          style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
        >
          <Icon size={20} color="#FFFFFF" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white leading-tight">
            {tr(slide.titleKh, slide.titleEn)}
          </p>
          <p className="text-[11px] text-white/75 leading-relaxed mt-0.5">
            {tr(slide.descKh, slide.descEn)}
          </p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 px-4 pb-2.5 justify-center relative">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: active === i ? 16 : 6,
              height: 6,
              backgroundColor: active === i ? COLORS.accentGold : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
