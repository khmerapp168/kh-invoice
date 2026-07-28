import { useEffect, useState } from 'react';
import {
  Receipt,
  Wallet,
  Package,
  BarChart3,
  Download,
  Share2,
  Plus,
  CheckCircle2,
  Apple,
  ChevronRight,
  X,
} from 'lucide-react';
import { COLORS, khmerFont } from '../lib/theme';
import logoFull from '../assets/logo-install.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  lang: 'KH' | 'EN';
  onLangToggle: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onDismiss: () => void;
  onInstalled: () => void;
}

const FEATURES = [
  {
    icon: Receipt,
    titleKh: 'វិក្កយបត្រ',
    titleEn: 'Invoices',
    descKh: 'បង្កើត និងចែករំលែកវិក្កយបត្របានយ៉ាងងាយ',
    descEn: 'Create and share invoices effortlessly',
    gradient: 'linear-gradient(135deg, #4EA1E8, #2E86C1)',
  },
  {
    icon: Wallet,
    titleKh: 'ហិរញ្ញវត្ថុ',
    titleEn: 'Finance',
    descKh: 'តាមដានចំណូល និងចំណាយតាមរយៈប្រាក់ USD/KHR',
    descEn: 'Track income & expenses in USD/KHR',
    gradient: 'linear-gradient(135deg, #34C77B, #1F9D6B)',
  },
  {
    icon: Package,
    titleKh: 'ស្តុកទំនិញ',
    titleEn: 'Stock',
    descKh: 'គ្រប់គ្រងស្តុកផលិតផលបានត្រឹមត្រូវ',
    descEn: 'Manage product stock accurately',
    gradient: 'linear-gradient(135deg, #22B491, #0F6E56)',
  },
  {
    icon: BarChart3,
    titleKh: 'របាយការណ៍',
    titleEn: 'Reports',
    descKh: 'មើលស្ថិតិ និងទិន្នន័យអាជីវកម្ម',
    descEn: 'View business statistics and data',
    gradient: `linear-gradient(135deg, ${COLORS.accentGold}, ${COLORS.accentGoldDark})`,
  },
];

export default function InstallScreen({ lang, onLangToggle, onSignIn, onSignUp, onDismiss, onInstalled }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Auto-rotate feature slides
  useEffect(() => {
    const t = setInterval(() => setActiveSlide((s) => (s + 1) % FEATURES.length), 3500);
    return () => clearInterval(t);
  }, []);

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  const handleInstall = async () => {
    if (installEvent) {
      setInstalling(true);
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstalling(false);
      setInstallEvent(null);
      if (choice.outcome === 'accepted') {
        onInstalled();
      }
      return;
    }
    if (isIOS) {
      setShowIOSHelp(true);
    }
  };

  const canInstall = !isStandalone && (installEvent || isIOS);

  return (
    <div
      className="min-h-screen w-full flex flex-col relative overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${COLORS.navyGradientStart} 0%, ${COLORS.navyGradientEnd} 60%, #0F3358 100%)`,
        ...khmerFont,
      }}
    >
      {/* Top bar: language + skip */}
      <div
        className="flex justify-between items-center px-4 relative z-10"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={onLangToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
        >
          {lang === 'KH' ? 'ខ្មែរ | EN' : 'EN | ខ្មែរ'}
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
        >
          {tr('រំលង', 'Skip')}
          <X size={14} color="#FFFFFF" strokeWidth={2} />
        </button>
      </div>

      {/* Hero — logo lockup sits directly on the gradient background,
         no glow behind it; uses the 2048px master so it stays crisp
         at this larger display size */}
      <div className="flex flex-col items-center px-6 pt-6 pb-1 relative z-10">
        <div className="relative flex items-center justify-center" style={{ width: 300, height: 168 }}>
          <img
            src={logoFull}
            alt="KH Invoice — Digital Invoicing Solutions"
            className="relative w-[270px] object-contain"
            style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))' }}
          />
        </div>

        <p className="text-[12.5px] font-medium text-white/80 text-center leading-relaxed mt-1 max-w-[280px]">
          {tr(
            'វិក្កយបត្រ និងគ្រប់គ្រងទិន្នន័យអាជីវកម្មគ្រប់ប្រភេទ',
            'Invoices & Business Data Management'
          )}
        </p>
      </div>

      {/* Feature carousel — translucent glass, blends seamlessly with the hero gradient */}
      <div className="flex-1 px-5 pt-4 relative z-10 flex flex-col justify-center max-h-[260px]">
        <div
          className="rounded-3xl p-5 min-h-[112px] flex flex-col justify-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          }}
        >
          <div
            className="absolute rounded-full pointer-events-none"
            style={{ width: 130, height: 130, top: -45, right: -35, background: 'rgba(255,255,255,0.06)' }}
          />
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-4 transition-all duration-500 relative"
              style={{
                opacity: activeSlide === i ? 1 : 0,
                transform: activeSlide === i ? 'translateX(0)' : 'translateX(20px)',
                position: activeSlide === i ? 'relative' : 'absolute',
                pointerEvents: activeSlide === i ? 'auto' : 'none',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: f.gradient, boxShadow: '0 6px 14px rgba(0,0,0,0.22)' }}
              >
                <f.icon size={26} color="#FFFFFF" strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-white leading-tight">
                  {lang === 'KH' ? f.titleKh : f.titleEn}
                </p>
                <p className="text-[11.5px] text-white/75 mt-1 leading-relaxed">
                  {lang === 'KH' ? f.descKh : f.descEn}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Slide dots */}
        <div className="flex justify-center gap-2 mt-4">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: activeSlide === i ? 24 : 8,
                height: 8,
                backgroundColor: activeSlide === i ? COLORS.accentGold : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>

        {/* Caption */}
        <p className="text-center text-sm text-white/90 mt-5 leading-relaxed px-2">
          {tr(
            'ដំឡើងជា App ដើម្បីប្រើប្រាស់លឿន និងដំណើរការក្រៅបណ្តាញ',
            'Install as an App for faster access and offline use'
          )}
        </p>
      </div>

      {/* Action buttons */}
      <div
        className="px-5 pt-2 relative z-10 space-y-2.5"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
      >
        {canInstall && (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{
              background: `linear-gradient(135deg, ${COLORS.accentGold}, ${COLORS.accentGoldDark})`,
              boxShadow: `0 6px 16px ${COLORS.accentGoldDark}55`,
            }}
          >
            <Download size={18} color="#FFFFFF" strokeWidth={2.5} />
            {installing
              ? tr('កំពុងដំឡើង...', 'Installing...')
              : isIOS
              ? tr('ដំឡើងលើ iOS', 'Install on iOS')
              : tr('ដំឡើងលើ Android', 'Install on Android')}
          </button>
        )}

        <button
          onClick={onSignUp}
          className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: '#FFFFFF', color: COLORS.navy, boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}
        >
          {tr('ចុះឈ្មោះថ្មី', 'Create New Account')}
          <ChevronRight size={18} color={COLORS.navy} strokeWidth={2} />
        </button>

        <button
          onClick={onSignIn}
          className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.3)' }}
        >
          {tr('មានគណនីរួចហើយ? ចូលប្រើ', 'Already have an account? Sign In')}
        </button>
      </div>

      {/* iOS install help modal */}
      {showIOSHelp && (
        <div
          className="fixed inset-0 flex items-end z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowIOSHelp(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-6"
            style={{ boxShadow: '0 -4px 10px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <Apple size={22} color={COLORS.navy} strokeWidth={2} />
              <h3 className="text-base font-bold" style={{ color: COLORS.navy }}>
                {tr('ដំឡើង KH Invoice លើ iOS', 'Install KH Invoice on iOS')}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.goldTint }}>
                  <Share2 size={16} color={COLORS.goldDark} strokeWidth={2} />
                </div>
                <p className="text-sm" style={{ color: COLORS.navy }}>
                  {tr('១. ចុចរូប Share នៅខាងក្រោម Safari', '1. Tap the Share icon at the bottom of Safari')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.goldTint }}>
                  <Plus size={16} color={COLORS.goldDark} strokeWidth={2} />
                </div>
                <p className="text-sm" style={{ color: COLORS.navy }}>
                  {tr('២. ជ្រើស "Add to Home Screen"', '2. Select "Add to Home Screen"')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.goldTint }}>
                  <CheckCircle2 size={16} color={COLORS.goldDark} strokeWidth={2} />
                </div>
                <p className="text-sm" style={{ color: COLORS.navy }}>
                  {tr('៣. ចុច "Add" — រួចរាល់!', '3. Tap "Add" — done!')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowIOSHelp(false)}
              className="w-full py-3 rounded-xl font-bold text-white text-sm mt-5"
              style={{ backgroundColor: COLORS.navy }}
            >
              {tr('យល់ព្រម', 'Got it')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
