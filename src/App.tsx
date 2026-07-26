import { useState, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Home as HomeIcon,
  Wallet,
  Plus,
  Package,
  Receipt,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Eye,
  EyeOff,
  Send,
  ChevronRight,
  Landmark,
  Image as ImageIcon,
  CreditCard,
  Bell,
  LogOut,
  Languages,
  User as UserIcon,
  BarChart3,
  DollarSign,
  Download,
  Share2,
  X,
  CheckCircle2,
  Clock,
  Maximize2,
  HelpCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Users, Tag } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { IconBadge } from './components/IconBadge';
import InvoiceScreen from './components/InvoiceScreen';
import SubscriptionModal from './components/SubscriptionModal';
import InvoiceOverview from './components/InvoiceOverview';
import StockScreen from './components/StockScreen';
import AccountScreen from './components/AccountScreen';
import ReportScreen from './components/ReportScreen';
import CustomerScreen from './components/CustomerScreen';
import CategoryScreen from './components/CategoryScreen';
import { COLORS, khmerFont, latinFont, DEFAULT_UNITS } from './lib/theme';
import InstallScreen from './components/InstallScreen';
import FeatureBanner from './components/FeatureBanner';
import AuthFeatureCarousel from './components/AuthFeatureCarousel';
import logoIcon from './assets/logo-icon.svg';





const WEEKDAY_SHORT_KH = ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'];
const WEEKDAY_SHORT_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const TRIAL_DAYS = 30;

const phoneToEmail = (digits: string) => `${digits}@khinvoice.app`;

type Screen = 'Install' | 'SignIn' | 'SignUp' | 'Home' | 'Finance' | 'InvoiceOverview' | 'Invoice' | 'Stock' | 'Account' | 'Report' | 'Customer' | 'Category';

interface Profile {
  id: string;
  business_name: string | null;
  username: string | null;
  phone: string | null;
  is_locked: boolean | null;
  trial_started_at: string | null;
  qr_code_url: string | null;
  avatar_url: string | null;
  subscription_qr_url: string | null;
  stock_module_enabled: boolean | null;
}

interface Transaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  transaction_date: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  amount: number;
  currency: 'USD' | 'KHR';
  created_at: string;
  source?: 'manual' | 'invoice' | 'stock';
  reference_id?: string | null;
  category_id?: string | null;
  transaction_categories?: { id: string; name: string; color: string | null } | null;
}

function toE164Digits(input: string) {
  const digits = input.replace(/\D/g, '');
  return digits.startsWith('0') ? digits.substring(1) : digits;
}

function formatKhmerPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function getTrialDaysRemaining(trialStartedAt: string | null): number {
  if (!trialStartedAt) return TRIAL_DAYS;
  const start = new Date(trialStartedAt).getTime();
  const now = Date.now();
  const elapsedDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(0, TRIAL_DAYS - elapsedDays);
}

function toKhmerNumber(n: number): string {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n)
    .split('')
    .map((c) => (/[0-9]/.test(c) ? map[parseInt(c, 10)] : c))
    .join('');
}

function formatMoney(usd: number, khr: number) {
  const parts: string[] = [];
  if (usd)
    parts.push(
      `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  if (khr) parts.push(`${khr.toLocaleString()} ៛`);
  return parts.length ? parts.join(' + ') : '$0.00';
}

function moneyDisplay(t: Transaction): string {
  const sign = t.type === 'income' ? '+' : '-';
  const num = Number(t.amount).toLocaleString(
    undefined,
    t.currency === 'USD' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}
  );
  return `${sign}${t.currency === 'USD' ? '$' : ''}${num}${t.currency === 'KHR' ? ' ៛' : ''}`;
}

function computeTotals(list: Transaction[]) {
  const sum = (type: string, currency: string) =>
    list
      .filter((t) => t.type === type && t.currency === currency)
      .reduce((acc, t) => acc + Number(t.amount), 0);
  return {
    incomeUSD: sum('income', 'USD'),
    incomeKHR: sum('income', 'KHR'),
    expenseUSD: sum('expense', 'USD'),
    expenseKHR: sum('expense', 'KHR'),
  };
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    try {
      if (localStorage.getItem('kh_invoice_installed') === '1') return 'SignIn';
    } catch {}
    return 'Install';
  });
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [lang, setLang] = useState<'KH' | 'EN'>('KH');
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [signInPhone, setSignInPhone] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [signInBusy, setSignInBusy] = useState(false);

  const [signUpStep, setSignUpStep] = useState(1);
  const [bizName, setBizName] = useState('');
  const [username, setUsername] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpBusy, setSignUpBusy] = useState(false);

  const [isExchangeOpen, setIsExchangeOpen] = useState(false);
  const [usdAmount, setUsdAmount] = useState('1');
  const exchangeRate = 4020;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; type: 'income' | 'expense'; color: string | null }[]>([]);
  const [addCategoryId, setAddCategoryId] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addType, setAddType] = useState<'income' | 'expense'>('income');
  const [addDescription, setAddDescription] = useState('');
  const [addQuantity, setAddQuantity] = useState('1');
  const [addUnit, setAddUnit] = useState(DEFAULT_UNITS[0]);
  const [addUnitPrice, setAddUnitPrice] = useState('');
  const [addCurrency, setAddCurrency] = useState<'USD' | 'KHR'>('USD');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const [financeRange, setFinanceRange] = useState<'today' | 'month' | 'year' | 'custom'>('today');
  const [financeCurrency, setFinanceCurrency] = useState<'all' | 'USD' | 'KHR'>('all');
  const [financeCategoryFilter, setFinanceCategoryFilter] = useState<string>('all');
  const [financeShowCatBreakdown, setFinanceShowCatBreakdown] = useState(true);
  const [financeCustomStart, setFinanceCustomStart] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [financeCustomEnd, setFinanceCustomEnd] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [timeStr, setTimeStr] = useState('00:00:00');
  useEffect(() => {
    const timer = setInterval(() => setTimeStr(new Date().toTimeString().split(' ')[0]), 1000);
    return () => clearInterval(timer);
  }, []);

  // ---------- PWA "Install App" banner ----------
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSInstallHelp, setShowIOSInstallHelp] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;
    if (localStorage.getItem('kh-invoice-install-dismissed') === '1') return;

    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS) {
      setShowInstallBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('kh-invoice-install-dismissed', '1');
  };

  const handleInstallClick = async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
      setShowInstallBanner(false);
      return;
    }
    // iOS has no programmatic prompt — walk the user through it instead.
    setShowIOSInstallHelp(true);
  };

  const trialDaysRemaining = getTrialDaysRemaining(profile?.trial_started_at ?? null);
  const showTrialBanner = trialDaysRemaining > 0 && trialDaysRemaining <= 7;

  // Dedicated full-screen "see everything" view — separate from the
  // dashboard, always scrollable top to bottom.
  const [homeShowAllTx, setHomeShowAllTx] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [homeStatsTab, setHomeStatsTab] = useState<'today' | 'month'>('today');
  const [financeShowAllTx, setFinanceShowAllTx] = useState(false);

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, transaction_categories(id, name, color)')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    setTransactionsLoading(false);
    if (error) {
      console.error('Failed to load transactions:', error);
      return;
    }
    setTransactions((data as Transaction[]) || []);
  };

  const fetchCustomUnits = async () => {
    const { data, error } = await supabase.from('custom_units').select('name').order('created_at');
    if (!error) setCustomUnits((data || []).map((u: { name: string }) => u.name));
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('transaction_categories')
      .select('id, name, type, color')
      .order('name');
    if (!error) setCategories((data || []) as typeof categories);
  };

  const fetchHomeCounts = async () => {
    const now = new Date();
    const mStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const mEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    ).padStart(2, '0')}`;
    const [invRes, prodRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .gte('invoice_date', mStart)
        .lte('invoice_date', mEnd),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    if (!invRes.error) setInvoiceCount(invRes.count ?? 0);
    if (!prodRes.error) setProductCount(prodRes.count ?? 0);
  };

  useEffect(() => {
    if (currentScreen === 'Home' || currentScreen === 'Finance') {
      fetchTransactions();
      fetchCustomUnits();
      fetchCategories();
    }
    if (currentScreen === 'Home') {
      fetchHomeCounts();
    }
  }, [currentScreen]);

  const openAddModal = (type: 'income' | 'expense') => {
    setAddType(type);
    setAddCategoryId('');
    setAddDescription('');
    setAddQuantity('1');
    setAddUnit(DEFAULT_UNITS[0]);
    setAddUnitPrice('');
    setAddCurrency('USD');
    setAddDate(new Date().toISOString().slice(0, 10));
    setAddError('');
    setShowAddUnit(false);
    setNewUnitName('');
    setIsAddOpen(true);
  };

  const handleAddNewUnit = async () => {
    const name = newUnitName.trim();
    if (!name) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase
      .from('custom_units')
      .upsert({ user_id: userData.user.id, name }, { onConflict: 'user_id,name' });
    setCustomUnits((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setAddUnit(name);
    setNewUnitName('');
    setShowAddUnit(false);
  };

  const handleAddTransaction = async () => {
    setAddError('');
    const qty = parseFloat(addQuantity);
    const price = parseFloat(addUnitPrice);
    if (!addDescription.trim()) {
      setAddError(lang === 'KH' ? 'សូមបញ្ចូល Description' : 'Please enter a description');
      return;
    }
    if (!qty || qty <= 0) {
      setAddError(lang === 'KH' ? 'សូមបញ្ចូលចំនួនត្រឹមត្រូវ' : 'Please enter a valid quantity');
      return;
    }
    if (!price || price <= 0) {
      setAddError(lang === 'KH' ? 'សូមបញ្ចូលតម្លៃត្រឹមត្រូវ' : 'Please enter a valid price');
      return;
    }
    setAddBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('transactions').insert({
      user_id: userData.user?.id,
      type: addType,
      description: addDescription.trim(),
      quantity: qty,
      unit: addUnit,
      unit_price: price,
      currency: addCurrency,
      transaction_date: addDate,
      category_id: addCategoryId || null,
    });
    setAddBusy(false);
    if (error) {
      setAddError(error.message || (lang === 'KH' ? 'មិនអាចរក្សាទុកបានទេ' : 'Could not save'));
      return;
    }
    setIsAddOpen(false);
    fetchTransactions();
  };

  const { incomeUSD, incomeKHR, expenseUSD, expenseKHR } = useMemo(
    () => computeTotals(transactions),
    [transactions]
  );

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  ).padStart(2, '0')}`;
  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.transaction_date >= monthStart && t.transaction_date <= monthEnd),
    [transactions, monthStart, monthEnd]
  );
  const monthTotals = useMemo(() => computeTotals(monthTransactions), [monthTransactions]);
  const monthLabel = now.toLocaleDateString(lang === 'KH' ? 'km-KH' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Today-only totals for the Home screen Today/Month stats toggle.
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayTransactions = useMemo(
    () => transactions.filter((t) => t.transaction_date === todayStr),
    [transactions, todayStr]
  );
  const todayTotals = useMemo(() => computeTotals(todayTransactions), [todayTransactions]);
  const todayLabel = now.toLocaleDateString(lang === 'KH' ? 'km-KH' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  // Time-of-day greeting shown at the top of the Home screen.
  const currentHour = now.getHours();
  const greeting =
    lang === 'KH'
      ? currentHour < 12
        ? 'អរុណសួស្តី'
        : currentHour < 18
        ? 'ទិវាសួស្តី'
        : 'សាយណ្ហសួស្តី'
      : currentHour < 12
      ? 'Good morning'
      : currentHour < 18
      ? 'Good afternoon'
      : 'Good evening';

  // Last 7 days of cash flow for the Home screen "pulse" widget.
  // Both currencies are folded into a single USD-equivalent figure
  // (using the same exchange rate as the Exchange tool) purely to size
  // the bars — the exact per-currency totals still live in the Balance
  // and Monthly Statistics cards above.
  const weeklyFlow = useMemo(() => {
    const todayDate = new Date();
    const days = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - (6 - idx));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayTotals = computeTotals(transactions.filter((t) => t.transaction_date === key));
      const incomeEq = dayTotals.incomeUSD + dayTotals.incomeKHR / exchangeRate;
      const expenseEq = dayTotals.expenseUSD + dayTotals.expenseKHR / exchangeRate;
      const labels = lang === 'KH' ? WEEKDAY_SHORT_KH : WEEKDAY_SHORT_EN;
      return {
        key,
        label: labels[d.getDay()],
        isToday: idx === 6,
        net: incomeEq - expenseEq,
      };
    });
    const maxAbs = Math.max(...days.map((d) => Math.abs(d.net)), 1);
    const weekNet = days.reduce((acc, d) => acc + d.net, 0);
    return { days, maxAbs, weekNet };
  }, [transactions, lang]);

  const getRangeDates = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (financeRange === 'today') {
      const s = toStr(today);
      return { start: s, end: s };
    }
    if (financeRange === 'month') {
      return {
        start: toStr(new Date(today.getFullYear(), today.getMonth(), 1)),
        end: toStr(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      };
    }
    if (financeRange === 'year') {
      return { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` };
    }
    return { start: financeCustomStart, end: financeCustomEnd };
  };

  const { start: rangeStart, end: rangeEnd } = getRangeDates();
  const filteredTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.transaction_date >= rangeStart &&
          t.transaction_date <= rangeEnd &&
          (financeCurrency === 'all' || t.currency === financeCurrency) &&
          (financeCategoryFilter === 'all' || t.category_id === financeCategoryFilter)
      ),
    [transactions, rangeStart, rangeEnd, financeCurrency, financeCategoryFilter]
  );
  const rangeTotals = useMemo(() => computeTotals(filteredTransactions), [filteredTransactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; incomeUSD: number; incomeKHR: number; expenseUSD: number; expenseKHR: number; count: number }>();
    for (const t of filteredTransactions) {
      const key = t.category_id || 'uncategorized';
      const catName = t.transaction_categories?.name || (lang === 'KH' ? 'គ្មានប្រភេទ' : 'Uncategorized');
      const catColor = t.transaction_categories?.color || null;
      if (!map.has(key)) map.set(key, { name: catName, color: catColor, incomeUSD: 0, incomeKHR: 0, expenseUSD: 0, expenseKHR: 0, count: 0 });
      const row = map.get(key)!;
      row.count++;
      if (t.type === 'income') {
        if (t.currency === 'USD') row.incomeUSD += Number(t.amount);
        else row.incomeKHR += Number(t.amount);
      } else {
        if (t.currency === 'USD') row.expenseUSD += Number(t.amount);
        else row.expenseKHR += Number(t.amount);
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.expenseUSD + b.expenseKHR + b.incomeUSD + b.incomeKHR) - (a.expenseUSD + a.expenseKHR + a.incomeUSD + a.incomeKHR));
  }, [filteredTransactions, lang]);

  const balanceUSD = incomeUSD - expenseUSD;
  const balanceKHR = incomeKHR - expenseKHR;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }: { data: { session: Session | null } }) => {
      const { session } = data;
      if (session) {
        const p = await loadProfile(session.user.id);
        if (p) {
          setProfile(p);
          setCurrentScreen('Home');
        }
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setCurrentScreen('SignIn');
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const passRules = {
    length: signUpPassword.length >= 8,
    upper: /[A-Z]/.test(signUpPassword),
    lower: /[a-z]/.test(signUpPassword),
    number: /[0-9]/.test(signUpPassword),
    special: /[^A-Za-z0-9]/.test(signUpPassword),
  };
  const isPasswordValid = Object.values(passRules).every(Boolean);
  const isConfirmMatch = signUpPassword && signUpPassword === signUpConfirmPassword;

  const handleSignInSubmit = async () => {
    setSignInError('');
    if (!signInPhone || !signInPassword) {
      setSignInError(lang === 'KH' ? 'សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់' : 'Please fill all fields');
      return;
    }
    setSignInBusy(true);
    const email = phoneToEmail(toE164Digits(signInPhone));
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: signInPassword,
    });
    setSignInBusy(false);

    if (error) {
      setSignInError(error.message);
      return;
    }

    const p = await loadProfile(data.user.id);
    if (p?.is_locked) {
      setSignInError(lang === 'KH' ? 'គណនីរបស់អ្នកត្រូវបានចាក់សោរ!' : 'Your account has been locked!');
      await supabase.auth.signOut();
      return;
    }

    setProfile(p);
    setCurrentScreen('Home');
  };

  const handleSignUpSubmit = async () => {
    setSignUpError('');
    setSignUpBusy(true);
    const email = phoneToEmail(toE164Digits(signUpPhone));
    const { data, error } = await supabase.auth.signUp({ email, password: signUpPassword });

    if (error) {
      setSignUpBusy(false);
      setSignUpError(error.message);
      return;
    }

    if (!data.session) {
      setSignUpBusy(false);
      setSignUpError(
        lang === 'KH'
          ? 'Email Confirmation នៅតែបើក! សូមចូល Supabase Dashboard → Authentication → Providers → Email ហើយបិទ "Confirm Email" ទម្លាក់ toggle។'
          : 'Email Confirmation is still ON! Go to Supabase Dashboard → Authentication → Providers → Email and turn OFF "Confirm Email" toggle.'
      );
      return;
    }

    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user?.id,
        business_name: bizName,
        username,
        phone: signUpPhone,
        trial_started_at: new Date().toISOString(),
        is_locked: false,
      })
      .select()
      .maybeSingle();

    setSignUpBusy(false);

    if (profileError) {
      setSignUpError(profileError.message);
      return;
    }

    setProfile(newProfile as Profile);
    setCurrentScreen('Home');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSignInPassword('');
    setCurrentScreen('SignIn');
  };

  const openTelegram = () => window.open('https://t.me/Khinv_123', '_blank');

  const t = {
    tagline: lang === 'KH' ? 'វិក្កយបត្រ និង គ្រប់គ្រងទិន្នន័យអាជីវកម្មគ្រប់ប្រភេទ' : 'Invoices & Business Data Management',
    login: lang === 'KH' ? 'ចូលប្រើ' : 'Sign In',
    signup: lang === 'KH' ? 'ចុះឈ្មោះ' : 'Sign Up',
    phone: lang === 'KH' ? 'លេខទូរស័ព្ទ' : 'Phone Number',
    password: lang === 'KH' ? 'លេខសម្ងាត់' : 'Password',
    help: lang === 'KH' ? 'ជំនួយការបច្ចេកទេស (Telegram)' : 'Technical Support (Telegram)',
    bizName: lang === 'KH' ? 'ឈ្មោះអាជីវកម្ម' : 'Business Name',
    username: lang === 'KH' ? 'ឈ្មោះអ្នកប្រើប្រាស់ (Username)' : 'Username',
    next: lang === 'KH' ? 'បន្ត' : 'Next',
    back: lang === 'KH' ? 'ត្រលប់ក្រោយ' : 'Back',
  };

  /* ---------- shared icon size constants ---------- */
  const INLINE = 20 as const;
  const NAV = 24 as const;
  const ACTION = 28 as const;

  /* ---------- inline icon button (for header actions etc.) ---------- */
  const IconBtn = ({
    icon: Icon,
    tint = 'navy',
    onClick,
    'aria-label': ariaLabel,
  }: {
    icon: LucideIcon;
    tint?: 'navy' | 'gold' | 'light' | 'stock' | 'invoice' | 'account';
    onClick?: () => void;
    'aria-label'?: string;
  }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: tint === 'light' ? 'rgba(255,255,255,0.16)' : '#FFFFFF',
        border: tint === 'light' ? 'none' : `1px solid ${COLORS.border}`,
      }}
    >
      <Icon size={15} color={tint === 'light' ? '#FFFFFF' : COLORS.navy} strokeWidth={2} />
    </button>
  );

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ backgroundColor: COLORS.bgApp }}
      >
        <p className="text-sm" style={{ color: COLORS.muted, ...khmerFont }}>
          {lang === 'KH' ? 'កំពុងផ្ទុក...' : 'Loading...'}
        </p>
      </div>
    );
  }

  /* ============================================
     ADD TRANSACTION MODAL
     ============================================ */
  const AddTransactionModal = () => (
    <div
      className="fixed inset-0 flex items-end z-40"
      style={{ backgroundColor: 'rgba(24,41,62,0.4)' }}
    >
      <div
        className="w-full bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: '0 -4px 10px rgba(24,41,62,0.1)' }}
      >
        <div
          className="flex rounded-lg border p-1 mb-4"
          style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8' }}
        >
          <button
            onClick={() => setAddType('income')}
            className="flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: addType === 'income' ? COLORS.success : 'transparent',
              color: addType === 'income' ? '#FFFFFF' : COLORS.muted,
            }}
          >
            <TrendingUp size={20} color={addType === 'income' ? '#FFFFFF' : COLORS.muted} strokeWidth={2} />
            {lang === 'KH' ? 'ចំណូល' : 'Income'}
          </button>
          <button
            onClick={() => setAddType('expense')}
            className="flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: addType === 'expense' ? COLORS.danger : 'transparent',
              color: addType === 'expense' ? '#FFFFFF' : COLORS.muted,
            }}
          >
            <TrendingDown size={20} color={addType === 'expense' ? '#FFFFFF' : COLORS.muted} strokeWidth={2} />
            {lang === 'KH' ? 'ចំណាយ' : 'Expense'}
          </button>
        </div>

        <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
          {lang === 'KH' ? 'រូបិយប័ណ្ណ' : 'Currency'}
        </label>
        <div
          className="flex rounded-lg border p-1 mb-4"
          style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8' }}
        >
          <button
            onClick={() => setAddCurrency('USD')}
            className="flex-1 py-2.5 rounded-md text-sm font-bold"
            style={{
              backgroundColor: addCurrency === 'USD' ? COLORS.navy : 'transparent',
              color: addCurrency === 'USD' ? '#FFFFFF' : COLORS.muted,
            }}
          >
            $ USD
          </button>
          <button
            onClick={() => setAddCurrency('KHR')}
            className="flex-1 py-2.5 rounded-md text-sm font-bold"
            style={{
              backgroundColor: addCurrency === 'KHR' ? COLORS.navy : 'transparent',
              color: addCurrency === 'KHR' ? '#FFFFFF' : COLORS.muted,
            }}
          >
            ៛ KHR
          </button>
        </div>

        <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
          {lang === 'KH' ? 'ប្រភេទ' : 'Category'}
        </label>
        <select
          value={addCategoryId}
          onChange={(e) => setAddCategoryId(e.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-3"
          style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy }}
        >
          <option value="">{lang === 'KH' ? '— គ្មានប្រភេទ —' : '— No category —'}</option>
          {categories.filter((c) => c.type === addType).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
          {lang === 'KH' ? 'ថ្ងៃទី' : 'Date'}
        </label>
        <input
          type="date"
          value={addDate}
          onChange={(e) => setAddDate(e.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-3"
          style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy }}
        />

        <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
          Description
        </label>
        <input
          value={addDescription}
          onChange={(e) => setAddDescription(e.target.value)}
          placeholder={lang === 'KH' ? 'ឧ. លក់កាហ្វេទឹកកក' : 'e.g. Iced coffee sales'}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-3"
          style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy }}
        />

        <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
          {lang === 'KH' ? 'ចំនួន' : 'Quantity'}
        </label>
        <div className="flex gap-2 mb-1">
          <input
            type="number"
            inputMode="decimal"
            value={addQuantity}
            onChange={(e) => setAddQuantity(e.target.value)}
            className="w-20 rounded-lg border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy, ...latinFont }}
          />
          <select
            value={addUnit}
            onChange={(e) => setAddUnit(e.target.value)}
            className="flex-1 rounded-lg border px-2 py-2.5 text-sm outline-none"
            style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy }}
          >
            {[...DEFAULT_UNITS, ...customUnits.filter((u) => !DEFAULT_UNITS.includes(u))].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddUnit(!showAddUnit)}
            className="w-11 rounded-lg border font-bold text-lg flex items-center justify-center"
            style={{ borderColor: COLORS.border, backgroundColor: COLORS.goldTint, color: COLORS.goldDark }}
          >
            +
          </button>
        </div>

        {showAddUnit && (
          <div className="flex gap-2 mb-2">
            <input
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              placeholder={lang === 'KH' ? 'ឯកតាថ្មី ឧ. កំប៉ុង' : 'New unit e.g. can'}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy }}
            />
            <button
              onClick={handleAddNewUnit}
              className="px-3 rounded-lg font-bold text-white text-xs"
              style={{ backgroundColor: COLORS.navy }}
            >
              {lang === 'KH' ? 'បន្ថែម' : 'Add'}
            </button>
          </div>
        )}
        <p className="text-[10px] mb-3" style={{ color: COLORS.muted }}>
          {lang === 'KH' ? 'ឯកតាជួយឲ្យដឹងថាជាចំណូល/ចំណាយអ្វី' : 'The unit helps identify what this transaction is'}
        </p>

        <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
          {lang === 'KH' ? 'តម្លៃ (មួយឯកតា)' : 'Price (per unit)'}
        </label>
        <div className="flex mb-3 rounded-lg border overflow-hidden" style={{ borderColor: COLORS.border }}>
          <span
            className="flex items-center px-3 text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: COLORS.navyTint, color: COLORS.navy, ...latinFont }}
          >
            {addCurrency === 'USD' ? '$' : '៛'}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={addUnitPrice}
            onChange={(e) => setAddUnitPrice(e.target.value)}
            placeholder="0.00"
            className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none"
            style={{ backgroundColor: '#FAFAF8', color: COLORS.navy, ...latinFont }}
          />
        </div>

        <p className="text-xs mb-3" style={{ color: COLORS.muted }}>
          {lang === 'KH' ? 'សរុប៖ ' : 'Total: '}
          <span className="font-bold" style={{ color: COLORS.navy, ...latinFont }}>
            {(() => {
              const qty = parseFloat(addQuantity) || 0;
              const price = parseFloat(addUnitPrice) || 0;
              const total = qty * price;
              return addCurrency === 'USD'
                ? `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `${total.toLocaleString()} ៛`;
            })()}
          </span>
        </p>

        {addError && (
          <div
            className="mb-3 p-2.5 rounded-lg border text-xs"
            style={{ backgroundColor: COLORS.dangerTint, borderColor: '#F4A8A0', color: COLORS.danger }}
          >
            {addError}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setIsAddOpen(false)}
            className="flex-1 py-3 rounded-lg font-bold text-sm border"
            style={{ borderColor: COLORS.border, color: COLORS.navy }}
          >
            {lang === 'KH' ? 'បោះបង់' : 'Cancel'}
          </button>
          <button
            onClick={handleAddTransaction}
            disabled={addBusy}
            className="flex-1 py-3 rounded-lg font-bold text-white text-sm disabled:opacity-60"
            style={{ backgroundColor: addType === 'income' ? COLORS.success : COLORS.danger }}
          >
            {addBusy
              ? lang === 'KH'
                ? 'កំពុងរក្សាទុក...'
                : 'Saving...'
              : lang === 'KH'
                ? 'រក្សាទុក'
                : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ============================================
     TAB BAR
     ============================================ */
  const TabBar = () => (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around"
      style={{
        borderColor: COLORS.border,
        height: 'calc(4rem + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <button onClick={() => setCurrentScreen('Home')} className="flex flex-col items-center flex-1">
        <IconBadge
          icon={HomeIcon}
          size={NAV}
          tint={currentScreen === 'Home' ? 'gold' : 'navy'}
          shape="rounded"
        />
        <span
          className="text-[10px] font-bold mt-0.5"
          style={{ color: currentScreen === 'Home' ? COLORS.gold : COLORS.muted }}
        >
          {lang === 'KH' ? 'ដើម' : 'Home'}
        </span>
      </button>
      <button onClick={() => setCurrentScreen('Finance')} className="flex flex-col items-center flex-1">
        <IconBadge
          icon={Wallet}
          size={NAV}
          tint={currentScreen === 'Finance' ? 'gold' : 'navy'}
          shape="rounded"
        />
        <span
          className="text-[10px] font-bold mt-0.5"
          style={{ color: currentScreen === 'Finance' ? COLORS.gold : COLORS.muted }}
        >
          {lang === 'KH' ? 'ហិរញ្ញវត្ថុ' : 'Finance'}
        </span>
      </button>
      <div className="w-16 flex justify-center -mt-3.5">
        <button
          onClick={() => {
            setEditInvoiceId(null);
            setCurrentScreen('Invoice');
          }}
          aria-label={lang === 'KH' ? 'បង្កើតវិក្កយបត្រ' : 'Create Invoice'}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: COLORS.gold, boxShadow: `0 4px 6px ${COLORS.gold}4D` }}
        >
          <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
        </button>
      </div>
      {(profile?.stock_module_enabled ?? true) && (
        <button onClick={() => setCurrentScreen('Stock')} className="flex flex-col items-center flex-1">
          <IconBadge icon={Package} size={NAV} tint="stock" shape="rounded" />
          <span
            className="text-[10px] mt-0.5"
            style={{ color: currentScreen === 'Stock' ? COLORS.stock : COLORS.muted, fontWeight: currentScreen === 'Stock' ? 700 : 400 }}
          >
            {lang === 'KH' ? 'ស្តុក' : 'Stock'}
          </span>
        </button>
      )}
      <button onClick={() => setCurrentScreen('Account')} className="flex flex-col items-center flex-1">
        <IconBadge icon={UserIcon} size={NAV} tint="account" shape="rounded" />
        <span
          className="text-[10px] mt-0.5"
          style={{ color: currentScreen === 'Account' ? COLORS.account : COLORS.muted, fontWeight: currentScreen === 'Account' ? 700 : 400 }}
        >
          {lang === 'KH' ? 'គណនី' : 'Account'}
        </span>
      </button>
    </div>
  );

  /* ============================================
     MAIN RENDER
     ============================================ */
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: COLORS.bgApp, ...khmerFont }}>
      {/* ============================================
         INSTALL / ONBOARDING
         ============================================ */}
      {currentScreen === 'Install' && (
        <InstallScreen
          lang={lang}
          onLangToggle={() => setLang(lang === 'KH' ? 'EN' : 'KH')}
          onSignIn={() => setCurrentScreen('SignIn')}
          onSignUp={() => setCurrentScreen('SignUp')}
          onDismiss={() => setCurrentScreen('SignIn')}
          onInstalled={() => {
            try {
              localStorage.setItem('kh_invoice_installed', '1');
            } catch {}
            setCurrentScreen('SignIn');
          }}
        />
      )}

      {/* ============================================
         SIGN IN
         ============================================ */}
      {currentScreen === 'SignIn' && (
        <div
          className="flex flex-col justify-center items-center p-4 min-h-[85vh]"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${COLORS.navyTint} 0%, ${COLORS.bgApp} 60%, ${COLORS.bgApp} 100%)`,
          }}
        >
          {/* Logo — no card, big and centered, description below */}
          <div className="flex flex-col items-center mt-2 mb-1">
            <div
              className="rounded-[30px] flex items-center justify-center relative"
              style={{
                width: 132,
                height: 132,
                background: `linear-gradient(150deg, #FFFFFF 0%, ${COLORS.navyTint} 100%)`,
                boxShadow: '0 14px 32px rgba(12,68,124,0.18)',
              }}
            >
              <img
                src={logoIcon}
                alt="KH Invoice"
                className="w-[92px] h-[92px] object-contain"
              />
            </div>
            <span
              className="text-[28px] font-extrabold tracking-wide mt-3"
              style={{ color: COLORS.navy, ...latinFont }}
            >
              KH INVOICE
            </span>
            <span
              className="text-xs text-center mt-1 leading-relaxed max-w-[260px]"
              style={{ color: COLORS.muted }}
            >
              {t.tagline}
            </span>
          </div>

          {/* Auto-play feature highlights — same visual language as the Home banner */}
          <AuthFeatureCarousel lang={lang} />

          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden bg-white mt-4"
            style={{ boxShadow: '0 10px 28px rgba(24,41,62,0.10)', border: `1px solid ${COLORS.border}` }}
          >
            <div className="p-6">
              <h2 className="text-lg font-bold" style={{ color: COLORS.navy }}>
                {t.login}
              </h2>
              <p className="text-xs mb-3" style={{ color: COLORS.muted }}>
                {lang === 'KH' ? 'សូមបញ្ចូលលេខទូរស័ព្ទ និងលេខសម្ងាត់របស់អ្នក' : 'Please input your credentials'}
              </p>

              <label
                className="text-xs font-semibold block mt-2 mb-1.5"
                style={{ color: COLORS.navy }}
              >
                {t.phone}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={signInPhone}
                onChange={(e) => setSignInPhone(formatKhmerPhoneDisplay(e.target.value))}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{
                  borderColor: COLORS.border,
                  backgroundColor: '#FAFAF8',
                  color: COLORS.navy,
                  ...latinFont,
                }}
              />

              <label
                className="text-xs font-semibold block mt-3 mb-1.5"
                style={{ color: COLORS.navy }}
              >
                {t.password}
              </label>
              <div
                className="flex items-center rounded-lg border pr-3"
                style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8' }}
              >
                <input
                  type={showSignInPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
                  style={{ color: COLORS.navy, ...latinFont }}
                />
                <button onClick={() => setShowSignInPassword(!showSignInPassword)}>
                  {showSignInPassword ? (
                    <Eye size={INLINE} color={COLORS.navy} strokeWidth={2} />
                  ) : (
                    <EyeOff size={INLINE} color={COLORS.navy} strokeWidth={2} />
                  )}
                </button>
              </div>

              {signInError && (
                <div
                  className="mt-3 p-2.5 rounded-lg border text-xs"
                  style={{ backgroundColor: COLORS.dangerTint, borderColor: '#F4A8A0', color: COLORS.danger }}
                >
                  {signInError}
                </div>
              )}

              <button
                onClick={handleSignInSubmit}
                disabled={signInBusy}
                className="w-full mt-4 py-3 rounded-lg font-bold text-white text-sm disabled:opacity-60"
                style={{ backgroundColor: COLORS.gold, boxShadow: `0 3px 5px ${COLORS.gold}33` }}
              >
                {signInBusy
                  ? lang === 'KH'
                    ? 'កំពុងចូល...'
                    : 'Signing in...'
                  : t.login}
              </button>

              <button
                onClick={() => setCurrentScreen('SignUp')}
                className="w-full mt-3 text-center text-xs"
                style={{ color: COLORS.muted }}
              >
                {lang === 'KH' ? 'មិនមានគណនី? ' : "Don't have account? "}
                <span className="font-bold" style={{ color: COLORS.gold }}>
                  {t.signup}
                </span>
              </button>

              <button
                onClick={openTelegram}
                className="w-full mt-5 pt-3 border-t text-xs font-semibold flex items-center justify-center gap-1.5"
                style={{ borderColor: COLORS.border, color: COLORS.goldDark }}
              >
                <Send size={INLINE} color={COLORS.goldDark} strokeWidth={2} />
                {t.help}
              </button>
            </div>
          </div>

          <div className="w-full max-w-sm text-center mt-4">
            <p className="text-[10px] font-medium" style={{ color: COLORS.muted }}>
              Build By: Pang Sokheng
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: COLORS.muted, opacity: 0.7 }}>
              Support By: @Cluade.com
            </p>
          </div>
        </div>
      )}

      {/* ============================================
         SIGN UP
         ============================================ */}
      {currentScreen === 'SignUp' && (
        <div
          className="flex flex-col justify-center items-center p-4 min-h-[85vh]"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${COLORS.navyTint} 0%, ${COLORS.bgApp} 60%, ${COLORS.bgApp} 100%)`,
          }}
        >
          {/* Logo — no card, big and centered, description below */}
          <div className="flex flex-col items-center mt-2 mb-1">
            <div
              className="rounded-[26px] flex items-center justify-center relative"
              style={{
                width: 108,
                height: 108,
                background: `linear-gradient(150deg, #FFFFFF 0%, ${COLORS.navyTint} 100%)`,
                boxShadow: '0 12px 28px rgba(12,68,124,0.18)',
              }}
            >
              <img
                src={logoIcon}
                alt="KH Invoice"
                className="w-[76px] h-[76px] object-contain"
              />
            </div>
            <span
              className="text-2xl font-extrabold tracking-wide mt-3"
              style={{ color: COLORS.navy, ...latinFont }}
            >
              KH INVOICE
            </span>
            <span
              className="text-xs text-center mt-1 leading-relaxed max-w-[260px]"
              style={{ color: COLORS.muted }}
            >
              {t.tagline}
            </span>
          </div>

          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden bg-white mt-4"
            style={{ boxShadow: '0 10px 28px rgba(24,41,62,0.10)', border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-center gap-2 pt-5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold transition-colors"
                style={{ backgroundColor: COLORS.navy }}
              >
                1
              </div>
              <div
                className="w-14 h-0.5 rounded-full transition-colors"
                style={{ backgroundColor: signUpStep === 2 ? COLORS.navy : COLORS.border }}
              />
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold transition-colors"
                style={{ backgroundColor: signUpStep === 2 ? COLORS.navy : COLORS.border, color: signUpStep === 2 ? '#FFFFFF' : COLORS.muted }}
              >
                2
              </div>
            </div>

            <div className="p-6">              {signUpStep === 1 ? (
                <div>
                  <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.navy }}>
                    {lang === 'KH' ? 'ព័ត៌មានអាជីវកម្ម' : 'Business Info'}
                  </h2>
                  <label
                    className="text-xs font-semibold block mb-1.5"
                    style={{ color: COLORS.navy }}
                  >
                    {t.bizName}
                  </label>
                  <input
                    placeholder={lang === 'KH' ? 'ឧ. ហាងកាហ្វេ ដានី' : 'e.g. Dany Cafe'}
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy }}
                  />

                  <label
                    className="text-xs font-semibold block mt-3 mb-1.5"
                    style={{ color: COLORS.navy }}
                  >
                    {t.username}
                  </label>
                  <input
                    placeholder="ឧ. dany_cafe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8', color: COLORS.navy }}
                  />

                  <button
                    disabled={!bizName || !username}
                    onClick={() => setSignUpStep(2)}
                    className="w-full mt-4 py-3 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-1"
                    style={{
                      backgroundColor: !bizName || !username ? '#C4C9CC' : COLORS.gold,
                    }}
                  >
                    {t.next} <ChevronRight size={INLINE} color="#FFFFFF" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.navy }}>
                    {lang === 'KH' ? 'សុវត្ថិភាពគណនី' : 'Security'}
                  </h2>
                  <label
                    className="text-xs font-semibold block mb-1.5"
                    style={{ color: COLORS.navy }}
                  >
                    {t.phone}
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={signUpPhone}
                    onChange={(e) => setSignUpPhone(formatKhmerPhoneDisplay(e.target.value))}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                    style={{
                      borderColor: COLORS.border,
                      backgroundColor: '#FAFAF8',
                      color: COLORS.navy,
                      ...latinFont,
                    }}
                  />

                  <label
                    className="text-xs font-semibold block mt-3 mb-1.5"
                    style={{ color: COLORS.navy }}
                  >
                    {t.password}
                  </label>
                  <div
                    className="flex items-center rounded-lg border pr-3"
                    style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8' }}
                  >
                    <input
                      type={showSignUpPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
                      style={{ color: COLORS.navy, ...latinFont }}
                    />
                    <button onClick={() => setShowSignUpPassword(!showSignUpPassword)}>
                      {showSignUpPassword ? (
                        <Eye size={INLINE} color={COLORS.navy} strokeWidth={2} />
                      ) : (
                        <EyeOff size={INLINE} color={COLORS.navy} strokeWidth={2} />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <span
                      className="text-[10px]"
                      style={{
                        color: passRules.length ? COLORS.success : COLORS.muted,
                        fontWeight: passRules.length ? 600 : 400,
                      }}
                    >
                      ● ≥ ៨ តួ
                    </span>
                    <span
                      className="text-[10px]"
                      style={{
                        color: passRules.upper ? COLORS.success : COLORS.muted,
                        fontWeight: passRules.upper ? 600 : 400,
                      }}
                    >
                      ● A-Z
                    </span>
                    <span
                      className="text-[10px]"
                      style={{
                        color: passRules.lower ? COLORS.success : COLORS.muted,
                        fontWeight: passRules.lower ? 600 : 400,
                      }}
                    >
                      ● a-z
                    </span>
                    <span
                      className="text-[10px]"
                      style={{
                        color: passRules.number ? COLORS.success : COLORS.muted,
                        fontWeight: passRules.number ? 600 : 400,
                      }}
                    >
                      ● 0-9
                    </span>
                    <span
                      className="text-[10px]"
                      style={{
                        color: passRules.special ? COLORS.success : COLORS.muted,
                        fontWeight: passRules.special ? 600 : 400,
                      }}
                    >
                      ● សញ្ញាពិសេស
                    </span>
                  </div>

                  <label
                    className="text-xs font-semibold block mt-3 mb-1.5"
                    style={{ color: COLORS.navy }}
                  >
                    {lang === 'KH' ? 'ផ្ទៀងផ្ទាត់លេខសម្ងាត់' : 'Confirm Password'}
                  </label>
                  <div
                    className="flex items-center rounded-lg border pr-3"
                    style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8' }}
                  >
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
                      style={{ color: COLORS.navy, ...latinFont }}
                    />
                    {signUpConfirmPassword && (
                      <span className="text-sm">{isConfirmMatch ? '✓' : '✗'}</span>
                    )}
                  </div>

                  {signUpError && (
                    <div
                      className="mt-3 p-2.5 rounded-lg border text-xs"
                      style={{
                        backgroundColor: COLORS.dangerTint,
                        borderColor: '#F4A8A0',
                        color: COLORS.danger,
                      }}
                    >
                      {signUpError}
                    </div>
                  )}

                  <button
                    disabled={!isPasswordValid || !isConfirmMatch || !signUpPhone || signUpBusy}
                    onClick={handleSignUpSubmit}
                    className="w-full mt-4 py-3 rounded-lg font-bold text-white text-sm disabled:opacity-60"
                    style={{
                      backgroundColor:
                        !isPasswordValid || !isConfirmMatch || !signUpPhone ? '#C4C9CC' : COLORS.gold,
                    }}
                  >
                    {signUpBusy
                      ? lang === 'KH'
                        ? 'កំពុងចុះឈ្មោះ...'
                        : 'Signing up...'
                      : t.signup}
                  </button>

                  <button
                    onClick={() => setSignUpStep(1)}
                    className="w-full mt-3 text-center text-xs font-bold flex items-center justify-center gap-1"
                    style={{ color: COLORS.gold }}
                  >
                    <ArrowLeft size={INLINE} color={COLORS.gold} strokeWidth={2} />
                    {t.back}
                  </button>
                </div>
              )}

              <button
                onClick={() => setCurrentScreen('SignIn')}
                className="w-full mt-3 text-center text-xs"
                style={{ color: COLORS.muted }}
              >
                {lang === 'KH' ? 'មានគណនីរួចហើយ? ' : 'Already have account? '}
                <span className="font-bold" style={{ color: COLORS.gold }}>
                  {t.login}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
         HOME
         ============================================ */}
      {currentScreen === 'Home' && (
        <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.bgApp }}>
          {/* Header — compact: smaller avatar, smaller icon buttons */}
          <div
            className="px-4 pb-4 relative overflow-hidden"
            style={{
              background: `linear-gradient(160deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})`,
              paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            }}
          >
            <div
              className="pointer-events-none absolute rounded-full"
              style={{ width: 140, height: 140, top: -75, right: -50, background: 'rgba(255,255,255,0.06)' }}
            />
            <div className="relative flex justify-between items-center">
              <div className="flex items-center flex-1 min-w-0">
                {profile?.avatar_url ? (
                  <div
                    className="rounded-xl overflow-hidden flex-shrink-0"
                    style={{ width: 38, height: 38, boxShadow: '0 0 0 2px rgba(255,255,255,0.32)' }}
                  >
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ width: 38, height: 38, backgroundColor: 'rgba(255,255,255,0.16)' }}
                  >
                    <ImageIcon size={17} color="#FFFFFF" strokeWidth={2} />
                  </div>
                )}
                <div className="ml-2 min-w-0">
                  <p className="text-[10px] font-semibold text-white/65 truncate">{greeting}</p>
                  <p className="text-[13px] font-bold text-white truncate">
                    {profile?.business_name || '...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setLang(lang === 'KH' ? 'EN' : 'KH')}
                  className="flex items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0"
                  style={{ width: 32, height: 32, backgroundColor: 'rgba(255,255,255,0.16)', color: '#FFFFFF' }}
                >
                  {lang === 'KH' ? 'ខ្មែរ' : 'EN'}
                </button>
                <IconBtn icon={Bell} tint="light" aria-label="Notifications" onClick={() => setShowSubscription(true)} />
                <IconBtn icon={LogOut} tint="light" onClick={handleLogout} aria-label="Logout" />
              </div>
            </div>
            <div className="relative flex items-center justify-between mt-2.5 gap-2">
              <p className="text-[10px] font-semibold text-white/70 truncate min-w-0" style={latinFont}>
                {new Date().toLocaleDateString(lang === 'KH' ? 'km-KH' : 'en-US', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}{' '}
                • {timeStr}
              </p>
              <button
                onClick={() => setShowTips(true)}
                aria-label={lang === 'KH' ? 'របៀបប្រើ' : 'How to use'}
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 22, height: 22, backgroundColor: 'rgba(255,255,255,0.16)' }}
              >
                <HelpCircle size={12} color="#FFFFFF" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Trial + Install — one slim strip, only when relevant */}
          {(showTrialBanner || showInstallBanner) && (
            <div
              className="mx-3.5 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(12,68,124,0.1)', border: `1px solid ${COLORS.border}` }}
            >
              {showInstallBanner ? (
                <img src="/icon-192.png" alt="" className="w-5 h-5 rounded-md flex-shrink-0" />
              ) : (
                <Clock size={13} color={COLORS.goldDark} strokeWidth={2} className="flex-shrink-0" />
              )}
              <p className="flex-1 min-w-0 truncate text-[11px] font-semibold" style={{ color: COLORS.navy }}>
                {showInstallBanner
                  ? lang === 'KH' ? 'ដំឡើង KH Invoice ជា App' : 'Install KH Invoice App'
                  : lang === 'KH'
                  ? `សាកល្បង — នៅសល់ ${toKhmerNumber(trialDaysRemaining)} ថ្ងៃ`
                  : `Trial — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left`}
              </p>
              {showInstallBanner && (
                <>
                  <button
                    onClick={handleInstallClick}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-white text-[10px] flex-shrink-0"
                    style={{ backgroundColor: COLORS.gold }}
                  >
                    <Download size={11} color="#FFFFFF" strokeWidth={2.5} />
                    {lang === 'KH' ? 'ដំឡើង' : 'Install'}
                  </button>
                  <button onClick={dismissInstallBanner} aria-label="Dismiss" className="flex-shrink-0">
                    <X size={14} color={COLORS.muted} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Content */}
          <div className="relative flex-1 min-h-0">
          <div className="app-scroll h-full overflow-y-auto overflow-x-hidden p-3.5 pb-24 flex flex-col">
          <div className="mx-auto w-full flex-1 flex flex-col" style={{ maxWidth: 480 }}>

            {/* Balance card — compact */}
            <div
              className="relative rounded-3xl overflow-hidden flex-shrink-0"
              style={{
                padding: 18,
                background: `linear-gradient(135deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})`,
                boxShadow: '0 8px 18px rgba(12,68,124,0.26), 0 2px 5px rgba(12,68,124,0.14)',
              }}
            >
              <div
                className="absolute rounded-full"
                style={{ width: 110, height: 110, top: -40, right: -30, background: 'rgba(255,255,255,0.06)' }}
              />
              <div className="relative flex items-center justify-between">
                <p className="text-[11px] font-semibold text-white/75 tracking-wide">
                  {lang === 'KH' ? 'សមតុល្យសរុប' : 'Total Balance'}
                </p>
                <button
                  onClick={() => setShowBalance((v) => !v)}
                  aria-label={lang === 'KH' ? 'លាក់/បង្ហាញសមតុល្យ' : 'Show/hide balance'}
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: 26, height: 26, background: 'rgba(255,255,255,0.15)' }}
                >
                  {showBalance ? (
                    <Eye size={13} className="text-white" />
                  ) : (
                    <EyeOff size={13} className="text-white" />
                  )}
                </button>
              </div>

              <div className="relative flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div
                    className="flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.15)' }}
                  >
                    <DollarSign size={13} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-white/60 leading-none">USD</p>
                    <p className="text-base font-extrabold text-white truncate leading-tight" style={latinFont}>
                      {showBalance
                        ? `$${balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '••••••'}
                    </p>
                  </div>
                </div>
                <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.16)' }} />
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div
                    className="flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.15)' }}
                  >
                    <span className="text-white text-xs font-bold">៛</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-white/60 leading-none">KHR</p>
                    <p className="text-base font-extrabold text-white truncate leading-tight" style={latinFont}>
                      {showBalance ? `${balanceKHR.toLocaleString()} ៛` : '••••••'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions — the main, centered focus of the screen so the
               most-used actions are always one easy tap away */}
            <div className="flex-1 flex flex-col items-center justify-center py-6 min-h-0">
              <div className="w-full">
                <p className="text-center text-sm font-bold mb-4" style={{ color: COLORS.navy }}>
                  {lang === 'KH' ? 'មុខងាររហ័ស' : 'Quick Actions'}
                </p>
                <div className="grid grid-cols-4 gap-x-3 gap-y-5 place-items-center">
                  {[
                    {
                      key: 'invoice',
                      icon: Receipt,
                      label: lang === 'KH' ? 'វិក្កយបត្រ' : 'Invoice',
                      gradient: 'linear-gradient(135deg, #4EA1E8, #2E86C1)',
                      onClick: () => setCurrentScreen('InvoiceOverview'),
                      show: true,
                    },
                    {
                      key: 'stock',
                      icon: Package,
                      label: lang === 'KH' ? 'ស្តុក' : 'Stock',
                      gradient: 'linear-gradient(135deg, #22B491, #0F6E56)',
                      onClick: () => setCurrentScreen('Stock'),
                      show: profile?.stock_module_enabled ?? true,
                    },
                    {
                      key: 'income',
                      icon: TrendingUp,
                      label: lang === 'KH' ? 'ចំណូល' : 'Income',
                      gradient: 'linear-gradient(135deg, #34C77B, #1F9D6B)',
                      onClick: () => openAddModal('income'),
                      show: true,
                    },
                    {
                      key: 'expense',
                      icon: TrendingDown,
                      label: lang === 'KH' ? 'ចំណាយ' : 'Expense',
                      gradient: 'linear-gradient(135deg, #F0785C, #E5533D)',
                      onClick: () => openAddModal('expense'),
                      show: true,
                    },
                    {
                      key: 'exchange',
                      icon: Landmark,
                      label: lang === 'KH' ? 'ប្តូរប្រាក់' : 'Exchange',
                      gradient: `linear-gradient(135deg, ${COLORS.accentGold}, ${COLORS.accentGoldDark})`,
                      onClick: () => setIsExchangeOpen(true),
                      show: true,
                    },
                    {
                      key: 'report',
                      icon: BarChart3,
                      label: lang === 'KH' ? 'របាយការណ៍' : 'Report',
                      gradient: `linear-gradient(135deg, ${COLORS.navyGradientEnd}, ${COLORS.navyGradientStart})`,
                      onClick: () => setCurrentScreen('Report'),
                      show: true,
                    },
                    {
                      key: 'customer',
                      icon: Users,
                      label: lang === 'KH' ? 'អតិថិជន' : 'Customer',
                      gradient: 'linear-gradient(135deg, #6FB3EC, #2E86C1)',
                      onClick: () => setCurrentScreen('Customer'),
                      show: true,
                    },
                    {
                      key: 'category',
                      icon: Tag,
                      label: lang === 'KH' ? 'ប្រភេទ' : 'Category',
                      gradient: `linear-gradient(135deg, #F2B84B, ${COLORS.accentGoldDark})`,
                      onClick: () => setCurrentScreen('Category'),
                      show: true,
                    },
                  ]
                    .filter((a) => a.show)
                    .map((action) => (
                      <button
                        key={action.key}
                        onClick={action.onClick}
                        className="flex flex-col items-center min-w-0 w-full"
                      >
                        <div
                          className="flex items-center justify-center rounded-2xl flex-shrink-0"
                          style={{
                            width: 54,
                            height: 54,
                            background: action.gradient,
                            boxShadow: '0 4px 10px rgba(12,68,124,0.18)',
                          }}
                        >
                          <action.icon size={23} color="#FFFFFF" strokeWidth={2.2} />
                        </div>
                        <span
                          className="text-[10.5px] font-semibold mt-1.5 truncate w-full text-center"
                          style={{ color: COLORS.navy }}
                        >
                          {action.label}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Overview — Today / Month toggle, compact secondary summary */}
            <div className="flex-shrink-0 mb-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold" style={{ color: COLORS.navy }}>
                  {lang === 'KH' ? 'ទិន្នន័យសង្ខេប' : 'Overview'}
                </p>
                <div
                  className="flex items-center rounded-full p-0.5 flex-shrink-0"
                  style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
                >
                  <button
                    onClick={() => setHomeStatsTab('today')}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: homeStatsTab === 'today' ? COLORS.navy : 'transparent',
                      color: homeStatsTab === 'today' ? '#FFFFFF' : COLORS.muted,
                    }}
                  >
                    {lang === 'KH' ? 'ថ្ងៃនេះ' : 'Today'}
                  </button>
                  <button
                    onClick={() => setHomeStatsTab('month')}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: homeStatsTab === 'month' ? COLORS.navy : 'transparent',
                      color: homeStatsTab === 'month' ? '#FFFFFF' : COLORS.muted,
                    }}
                  >
                    {lang === 'KH' ? 'ខែនេះ' : 'Month'}
                  </button>
                </div>
              </div>

              <div
                className="p-3.5 rounded-2xl"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
              >
                <p className="text-[10.5px] font-bold mb-2.5" style={{ color: COLORS.muted }}>
                  {homeStatsTab === 'today' ? todayLabel : monthLabel}
                </p>

                {(() => {
                  const activeTotals = homeStatsTab === 'today' ? todayTotals : monthTotals;
                  const maxVal = Math.max(activeTotals.incomeUSD, activeTotals.expenseUSD, 1);
                  const incomePct = Math.min(100, (activeTotals.incomeUSD / maxVal) * 100);
                  const expensePct = Math.min(100, (activeTotals.expenseUSD / maxVal) * 100);
                  return (
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-semibold" style={{ color: COLORS.navy }}>
                            {lang === 'KH' ? 'ចំណូល' : 'Income'}
                          </span>
                          <span className="text-[11px] font-bold" style={{ color: COLORS.success, ...latinFont }}>
                            {formatMoney(activeTotals.incomeUSD, activeTotals.incomeKHR)}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: COLORS.successTint }}>
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ width: `${incomePct}%`, background: 'linear-gradient(90deg, #34C77B, #1F9D6B)' }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-semibold" style={{ color: COLORS.navy }}>
                            {lang === 'KH' ? 'ចំណាយ' : 'Expense'}
                          </span>
                          <span className="text-[11px] font-bold" style={{ color: COLORS.danger, ...latinFont }}>
                            {formatMoney(activeTotals.expenseUSD, activeTotals.expenseKHR)}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: COLORS.dangerTint }}>
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ width: `${expensePct}%`, background: 'linear-gradient(90deg, #F0785C, #E5533D)' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2.5 mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div
                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ width: 24, height: 24, backgroundColor: COLORS.invoiceTint }}
                    >
                      <Receipt size={12} style={{ color: COLORS.invoice }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] truncate" style={{ color: COLORS.muted }}>
                        {lang === 'KH' ? 'វិក្កយបត្រខែនេះ' : 'Invoices'}
                      </p>
                      <p className="text-xs font-bold" style={{ color: COLORS.navy }}>
                        {invoiceCount === null ? '...' : invoiceCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div
                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ width: 24, height: 24, backgroundColor: COLORS.stockTint }}
                    >
                      <Package size={12} style={{ color: COLORS.stock }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] truncate" style={{ color: COLORS.muted }}>
                        {lang === 'KH' ? 'ស្តុកបច្ចុប្បន្ន' : 'Stock'}
                      </p>
                      <p className="text-xs font-bold" style={{ color: COLORS.navy }}>
                        {productCount === null ? '...' : productCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
          </div>
          </div>

          {/* Exchange modal */}
          {isExchangeOpen && (
            <div
              className="fixed inset-0 flex items-end z-40"
              style={{ backgroundColor: 'rgba(24,41,62,0.4)' }}
            >
              <div
                className="w-full bg-white rounded-t-2xl p-6"
                style={{ boxShadow: '0 -4px 10px rgba(24,41,62,0.1)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <IconBadge icon={Landmark} size={INLINE} tint="gold" shape="rounded" />
                  <h3 className="text-base font-bold" style={{ color: COLORS.navy }}>
                    {lang === 'KH' ? 'អត្រាប្តូរប្រាក់ប្រចាំថ្ងៃ' : 'Daily Exchange Rate'}
                  </h3>
                </div>
                <p className="text-sm mb-4" style={{ color: COLORS.goldDark, ...latinFont }}>
                  1 USD = {exchangeRate} KHR
                </p>
                <div
                  className="flex items-center rounded-lg border px-3.5 py-2.5 mb-3"
                  style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8' }}
                >
                  <span className="w-16 text-sm font-bold" style={latinFont}>
                    USD
                  </span>
                  <input
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(e.target.value)}
                    type="number"
                    className="flex-1 text-base outline-none bg-transparent"
                    style={{ color: COLORS.navy, ...latinFont }}
                  />
                </div>
                <div
                  className="flex items-center rounded-lg border px-3.5 py-2.5 mb-3"
                  style={{ borderColor: COLORS.border, backgroundColor: '#FAFAF8' }}
                >
                  <span className="w-16 text-sm font-bold" style={latinFont}>
                    KHR
                  </span>
                  <span className="flex-1 text-base font-bold" style={{ color: COLORS.success, ...latinFont }}>
                    {usdAmount ? (parseFloat(usdAmount) * exchangeRate).toLocaleString() : '0'} ៛
                  </span>
                </div>
                <button
                  onClick={() => setIsExchangeOpen(false)}
                  className="w-full py-3 rounded-lg font-bold text-white text-sm mt-2"
                  style={{ backgroundColor: COLORS.navy }}
                >
                  {lang === 'KH' ? 'បិទផ្ទាំង' : 'Close'}
                </button>
              </div>
            </div>
          )}

          {showIOSInstallHelp && (
            <div
              className="fixed inset-0 flex items-end z-40"
              style={{ backgroundColor: 'rgba(24,41,62,0.4)' }}
              onClick={() => setShowIOSInstallHelp(false)}
            >
              <div
                className="w-full bg-white rounded-t-2xl p-6"
                style={{ boxShadow: '0 -4px 10px rgba(24,41,62,0.1)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 mb-3">
                  <img src="/icon-192.png" alt="" className="w-9 h-9 rounded-lg" />
                  <h3 className="text-base font-bold" style={{ color: COLORS.navy }}>
                    {lang === 'KH' ? 'ដំឡើង KH Invoice' : 'Install KH Invoice'}
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.goldTint }}>
                      <Share2 size={14} color={COLORS.goldDark} strokeWidth={2} />
                    </div>
                    <p className="text-sm" style={{ color: COLORS.navy }}>
                      {lang === 'KH' ? '១. ចុចរូប Share នៅខាងក្រោម Safari' : '1. Tap the Share icon in Safari'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.goldTint }}>
                      <Plus size={14} color={COLORS.goldDark} strokeWidth={2} />
                    </div>
                    <p className="text-sm" style={{ color: COLORS.navy }}>
                      {lang === 'KH' ? '២. ជ្រើស "Add to Home Screen"' : '2. Select "Add to Home Screen"'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.goldTint }}>
                      <CheckCircle2 size={14} color={COLORS.goldDark} strokeWidth={2} />
                    </div>
                    <p className="text-sm" style={{ color: COLORS.navy }}>
                      {lang === 'KH' ? '៣. ចុច "Add" — រួចរាល់!' : '3. Tap "Add" — done!'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSInstallHelp(false)}
                  className="w-full py-3 rounded-lg font-bold text-white text-sm mt-5"
                  style={{ backgroundColor: COLORS.navy }}
                >
                  {lang === 'KH' ? 'យល់ព្រម' : 'Got it'}
                </button>
              </div>
            </div>
          )}

          {isAddOpen && AddTransactionModal()}
          {TabBar()}
          <FeatureBanner
            lang={lang}
            open={showTips}
            onClose={() => setShowTips(false)}
            onNavigate={(s) => setCurrentScreen(s)}
          />

          {/* Dedicated full-screen view — every transaction on record,
             always scrollable top to bottom */}
          {homeShowAllTx && (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: COLORS.bgApp }}>
              <div
                className="px-4 pt-5 pb-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})` }}
              >
                <button
                  onClick={() => setHomeShowAllTx(false)}
                  className="flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
                >
                  <ArrowLeft size={INLINE} color="#FFFFFF" strokeWidth={2} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base">
                    {lang === 'KH' ? 'ប្រតិបត្តិការទាំងអស់' : 'All Transactions'}
                  </p>
                  <p className="text-white/70 text-xs">
                    {transactions.length} {lang === 'KH' ? 'ជួរ' : 'rows'}
                  </p>
                </div>
              </div>
              <div className="app-scroll flex-1 overflow-y-auto p-3.5 pb-6">
                <div className="bg-white rounded-2xl py-1" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                  {transactions.length === 0 && (
                    <p className="text-xs text-center py-8" style={{ color: COLORS.muted }}>
                      {lang === 'KH' ? 'មិនទាន់មានប្រតិបត្តិការនៅឡើយទេ' : 'No transactions yet'}
                    </p>
                  )}
                  {transactions.map((tItem, i) => (
                    <div
                      key={tItem.id}
                      className="flex items-center px-3.5 py-2.5"
                      style={{ borderBottom: i < transactions.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}
                    >
                      <div className="mr-3">
                        <IconBadge
                          icon={tItem.type === 'income' ? TrendingUp : TrendingDown}
                          size={INLINE}
                          tint={tItem.type === 'income' ? 'success' : 'danger'}
                          shape="rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: COLORS.navy }}>
                          {tItem.description}
                        </p>
                        <p className="text-xs" style={{ color: COLORS.muted }}>
                          {tItem.quantity} {tItem.unit} • {tItem.transaction_date}
                        </p>
                      </div>
                      <span
                        className="text-sm font-bold"
                        style={{ color: tItem.type === 'income' ? COLORS.success : COLORS.danger, ...latinFont }}
                      >
                        {moneyDisplay(tItem)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================
         FINANCE
         ============================================ */}
      {currentScreen === 'Finance' && (
        <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.bgApp }}>
          <div
            className="px-4 pt-5 pb-6 flex items-center gap-3"
            style={{
              background: `linear-gradient(135deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})`,
            }}
          >
            <button
              onClick={() => setCurrentScreen('Home')}
              className="flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <ArrowLeft size={INLINE} color="#FFFFFF" strokeWidth={2} />
            </button>
            <div className="flex-1">
              <p className="text-white font-bold text-base">{lang === 'KH' ? 'ចំណូល / ចំណាយ' : 'Income / Expense'}</p>
              <p className="text-white/70 text-xs">
                {lang === 'KH' ? 'តាមដានលំហូរសាច់ប្រាក់អាជីវកម្មរបស់អ្នក' : 'Track your business cash flow'}
              </p>
            </div>
            <button
              onClick={() => openAddModal('income')}
              aria-label={lang === 'KH' ? 'បន្ថែមចំណូល/ចំណាយ' : 'Add Income/Expense'}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              <Plus size={INLINE} color="#FFFFFF" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setCurrentScreen('Report')}
              aria-label={lang === 'KH' ? 'របាយការណ៍' : 'Report'}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              <BarChart3 size={INLINE} color="#FFFFFF" strokeWidth={2} />
            </button>
            <button
              onClick={() => setFinanceShowAllTx(true)}
              aria-label={lang === 'KH' ? 'មើលពេញអេក្រង់' : 'View full screen'}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              <Maximize2 size={INLINE} color="#FFFFFF" strokeWidth={2} />
            </button>
          </div>

          {/* Always scrollable — no lock/unlock step needed anymore */}
          <div className="relative flex-1 min-h-0">
          <div className="app-scroll h-full p-3.5 pb-24 -mt-4 overflow-y-auto">
            {/* Currency view toggle — filter income/expense by USD, KHR (Riel), or both */}
            <div className="flex gap-2 mb-2.5">
              {[
                { key: 'all' as const, label: lang === 'KH' ? 'ទាំងអស់' : 'All', icon: Wallet },
                { key: 'USD' as const, label: 'USD ($)', icon: DollarSign },
                { key: 'KHR' as const, label: 'KHR (៛)', icon: Landmark },
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFinanceCurrency(c.key)}
                  aria-label={c.label}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border text-[11px] font-bold"
                  style={{
                    borderColor: COLORS.border,
                    backgroundColor: financeCurrency === c.key ? COLORS.gold : '#FFFFFF',
                    color: financeCurrency === c.key ? '#FFFFFF' : COLORS.navy,
                  }}
                >
                  <c.icon size={13} color={financeCurrency === c.key ? '#FFFFFF' : COLORS.navy} strokeWidth={2.2} />
                  {c.label}
                </button>
              ))}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-white" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                <IconBadge icon={TrendingUp} size={INLINE} tint="success" shape="rounded" />
                <p className="text-[10px] font-semibold mt-1.5" style={{ color: COLORS.muted }}>
                  {lang === 'KH' ? 'ចំណូល' : 'Income'}
                </p>
                <p className="text-xs font-bold mt-0.5" style={{ color: COLORS.success, ...latinFont }}>
                  {formatMoney(rangeTotals.incomeUSD, rangeTotals.incomeKHR)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                <IconBadge icon={TrendingDown} size={INLINE} tint="danger" shape="rounded" />
                <p className="text-[10px] font-semibold mt-1.5" style={{ color: COLORS.muted }}>
                  {lang === 'KH' ? 'ចំណាយ' : 'Expense'}
                </p>
                <p className="text-xs font-bold mt-0.5" style={{ color: COLORS.danger, ...latinFont }}>
                  {formatMoney(rangeTotals.expenseUSD, rangeTotals.expenseKHR)}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: COLORS.gold }}>
                <IconBadge icon={Wallet} size={INLINE} tint="white" shape="rounded" />
                <p className="text-[10px] font-semibold text-white/90 mt-1.5">
                  {lang === 'KH' ? 'នៅសល់' : 'Balance'}
                </p>
                <p className="text-xs font-bold mt-0.5 text-white" style={latinFont}>
                  {formatMoney(
                    rangeTotals.incomeUSD - rangeTotals.expenseUSD,
                    rangeTotals.incomeKHR - rangeTotals.expenseKHR
                  )}
                </p>
              </div>
            </div>

            {/* Range selectors */}
            <div className="flex gap-2 mt-4">
              {[
                { key: 'today' as const, label: lang === 'KH' ? 'ថ្ងៃនេះ' : 'Today' },
                { key: 'month' as const, label: lang === 'KH' ? 'ខែនេះ' : 'This Month' },
                { key: 'year' as const, label: lang === 'KH' ? 'ឆ្នាំនេះ' : 'This Year' },
                { key: 'custom' as const, label: lang === 'KH' ? 'ផ្ទាល់ខ្លួន' : 'Custom' },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => { setFinanceRange(r.key); setFinanceCategoryFilter('all'); }}
                  className="flex-1 py-2 rounded-lg border text-xs font-bold transition-colors"
                  style={{
                    borderColor: financeRange === r.key ? COLORS.navy : COLORS.border,
                    backgroundColor: financeRange === r.key ? COLORS.navy : '#FFFFFF',
                    color: financeRange === r.key ? '#FFFFFF' : COLORS.navy,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {financeRange === 'custom' && (
              <div className="flex gap-2 mt-2">
                <input
                  type="date"
                  value={financeCustomStart}
                  onChange={(e) => setFinanceCustomStart(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
                  style={{ borderColor: COLORS.border, backgroundColor: '#FFFFFF', color: COLORS.navy }}
                />
                <input
                  type="date"
                  value={financeCustomEnd}
                  onChange={(e) => setFinanceCustomEnd(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
                  style={{ borderColor: COLORS.border, backgroundColor: '#FFFFFF', color: COLORS.navy }}
                />
              </div>
            )}

            {/* Category breakdown — shows income/expense grouped by category for the selected range */}
            {financeShowCatBreakdown && categoryBreakdown.length > 0 && (
              <div className="mt-4 bg-white rounded-2xl p-3.5" style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <IconBadge icon={Tag} size={INLINE} tint="navy" shape="rounded" />
                    <p className="text-xs font-bold" style={{ color: COLORS.navy }}>
                      {lang === 'KH' ? 'សង្ខេបតាមប្រភេទ' : 'By Category'}
                    </p>
                  </div>
                  <button onClick={() => setFinanceShowCatBreakdown(false)} className="text-[10px]" style={{ color: COLORS.muted }}>
                    {lang === 'KH' ? 'បិទ' : 'Hide'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {categoryBreakdown.slice(0, 6).map((c, i) => {
                    const total = c.incomeUSD + c.incomeKHR + c.expenseUSD + c.expenseKHR;
                    const maxTotal = categoryBreakdown[0] ? (categoryBreakdown[0].incomeUSD + categoryBreakdown[0].incomeKHR + categoryBreakdown[0].expenseUSD + categoryBreakdown[0].expenseKHR) : 1;
                    const pct = Math.max(2, Math.round((total / maxTotal) * 100));
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: COLORS.navy }}>
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || COLORS.muted }} />
                            {c.name}
                            <span className="text-[9px] font-normal" style={{ color: COLORS.muted }}>({c.count})</span>
                          </span>
                          <span className="text-[11px] font-bold" style={{ color: COLORS.navy, ...latinFont }}>
                            {formatMoney(c.incomeUSD - c.expenseUSD, c.incomeKHR - c.expenseKHR)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.border }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color || COLORS.navy }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!financeShowCatBreakdown && categoryBreakdown.length > 0 && (
              <button onClick={() => setFinanceShowCatBreakdown(true)} className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold" style={{ borderColor: COLORS.border, color: COLORS.navy, backgroundColor: '#FFFFFF' }}>
                <Tag size={13} color={COLORS.navy} strokeWidth={2.2} />
                {lang === 'KH' ? 'បង្ហាញសង្ខេបតាមប្រភេទ' : 'Show Category Breakdown'}
              </button>
            )}

            {/* Category filter chips — horizontal scroll */}
            {categories.length > 0 && (
              <div className="mt-3 -mx-3.5 px-3.5 overflow-x-auto app-scroll" style={{ scrollbarWidth: 'none' }}>
                <div className="flex gap-1.5 pb-1" style={{ width: 'max-content' }}>
                  <button
                    onClick={() => setFinanceCategoryFilter('all')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor: financeCategoryFilter === 'all' ? COLORS.navy : '#FFFFFF',
                      color: financeCategoryFilter === 'all' ? '#FFFFFF' : COLORS.navy,
                      border: `1px solid ${financeCategoryFilter === 'all' ? COLORS.navy : COLORS.border}`,
                    }}
                  >
                    {lang === 'KH' ? 'ទាំងអស់' : 'All'}
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setFinanceCategoryFilter(financeCategoryFilter === c.id ? 'all' : c.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors"
                      style={{
                        backgroundColor: financeCategoryFilter === c.id ? (c.color || COLORS.navy) : '#FFFFFF',
                        color: financeCategoryFilter === c.id ? '#FFFFFF' : COLORS.navy,
                        border: `1px solid ${financeCategoryFilter === c.id ? (c.color || COLORS.navy) : COLORS.border}`,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color || COLORS.muted }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction table */}
            <div className="flex items-center justify-between mt-5 mb-2">
              <p className="text-sm font-bold" style={{ color: COLORS.navy }}>
                {lang === 'KH' ? 'តារាងប្រតិបត្តិការ' : 'Transactions'}
              </p>
              {!transactionsLoading && filteredTransactions.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.navyTint, color: COLORS.navy, ...latinFont }}>
                  {filteredTransactions.length}
                </span>
              )}
            </div>
            <div
              className="bg-white rounded-2xl overflow-hidden border"
              style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)', borderColor: COLORS.border }}
            >
              <div className="flex px-3 py-2 border-b" style={{ backgroundColor: '#FAFAF8', borderColor: COLORS.border }}>
                <span className="text-[10px] font-bold flex-[1.2]" style={{ color: COLORS.muted }}>
                  {lang === 'KH' ? 'ថ្ងៃទី' : 'Date'}
                </span>
                <span className="text-[10px] font-bold flex-[2]" style={{ color: COLORS.muted }}>
                  Description
                </span>
                <span className="text-[10px] font-bold flex-1 text-center" style={{ color: COLORS.muted }}>
                  {lang === 'KH' ? 'ចំនួន' : 'Qty'}
                </span>
                <span className="text-[10px] font-bold flex-[1.3] text-right" style={{ color: COLORS.muted }}>
                  {lang === 'KH' ? 'សរុប' : 'Total'}
                </span>
              </div>

              {transactionsLoading && (
                <p className="text-xs text-center py-4" style={{ color: COLORS.muted }}>
                  {lang === 'KH' ? 'កំពុងផ្ទុក...' : 'Loading...'}
                </p>
              )}
              {!transactionsLoading && filteredTransactions.length === 0 && (
                <div className="text-center py-8">
                  <IconBadge icon={Wallet} size={ACTION} tint="navy" shape="rounded" className="mx-auto" />
                  <p className="text-xs mt-3" style={{ color: COLORS.muted }}>
                    {lang === 'KH' ? 'មិនមានទិន្នន័យក្នុងចន្លោះនេះទេ' : 'No data in this range'}
                  </p>
                  <button
                    onClick={() => openAddModal('income')}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: COLORS.gold }}
                  >
                    <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                    {lang === 'KH' ? 'បន្ថែម' : 'Add'}
                  </button>
                </div>
              )}
              {filteredTransactions.map((tItem, i) => (
                <div
                  key={tItem.id}
                  className="flex items-center px-3 py-2.5"
                  style={{
                    borderBottom: i < filteredTransactions.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                  }}
                >
                  <span className="text-[11px] flex-[1.2]" style={{ color: COLORS.navy, ...latinFont }}>
                    {tItem.transaction_date}
                  </span>
                  <div className="flex-[2] pr-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: COLORS.navy }}>
                      {tItem.description}
                    </p>
                    {tItem.transaction_categories && (
                      <span
                        className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{
                          backgroundColor: (tItem.transaction_categories.color || COLORS.muted) + '20',
                          color: tItem.transaction_categories.color || COLORS.muted,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tItem.transaction_categories.color || COLORS.muted }} />
                        {tItem.transaction_categories.name}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] flex-1 text-center" style={{ color: COLORS.muted }}>
                    {tItem.quantity} {tItem.unit}
                  </span>
                  <span
                    className="text-[11px] font-bold flex-[1.3] text-right"
                    style={{
                      color: tItem.type === 'income' ? COLORS.success : COLORS.danger,
                      ...latinFont,
                    }}
                  >
                    {moneyDisplay(tItem)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="pointer-events-none absolute left-0 right-0 bottom-0 h-14"
            style={{ background: `linear-gradient(to top, ${COLORS.bgApp}, rgba(244,246,248,0))` }}
          />
          </div>

          {isAddOpen && AddTransactionModal()}
          {TabBar()}

          {/* Dedicated full-screen view — every filtered transaction,
             always scrollable top to bottom */}
          {financeShowAllTx && (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: COLORS.bgApp }}>
              <div
                className="px-4 pt-5 pb-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${COLORS.navyGradientStart}, ${COLORS.navyGradientEnd})` }}
              >
                <button
                  onClick={() => setFinanceShowAllTx(false)}
                  className="flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
                >
                  <ArrowLeft size={INLINE} color="#FFFFFF" strokeWidth={2} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base">
                    {lang === 'KH' ? 'ប្រតិបត្តិការទាំងអស់' : 'All Transactions'}
                  </p>
                  <p className="text-white/70 text-xs">
                    {filteredTransactions.length} {lang === 'KH' ? 'ជួរ' : 'rows'}
                  </p>
                </div>
              </div>
              <div className="app-scroll flex-1 overflow-y-auto p-3.5 pb-6">
                <div
                  className="bg-white rounded-2xl overflow-hidden border"
                  style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)', borderColor: COLORS.border }}
                >
                  <div className="flex px-3 py-2 border-b sticky top-0" style={{ backgroundColor: '#FAFAF8', borderColor: COLORS.border }}>
                    <span className="text-[10px] font-bold flex-[1.2]" style={{ color: COLORS.muted }}>
                      {lang === 'KH' ? 'ថ្ងៃទី' : 'Date'}
                    </span>
                    <span className="text-[10px] font-bold flex-[2]" style={{ color: COLORS.muted }}>
                      Description
                    </span>
                    <span className="text-[10px] font-bold flex-1 text-center" style={{ color: COLORS.muted }}>
                      {lang === 'KH' ? 'ចំនួន' : 'Qty'}
                    </span>
                    <span className="text-[10px] font-bold flex-[1.3] text-right" style={{ color: COLORS.muted }}>
                      {lang === 'KH' ? 'សរុប' : 'Total'}
                    </span>
                  </div>
                  {filteredTransactions.length === 0 && (
                    <p className="text-xs text-center py-8" style={{ color: COLORS.muted }}>
                      {lang === 'KH' ? 'មិនមានទិន្នន័យក្នុងចន្លោះនេះទេ' : 'No data in this range'}
                    </p>
                  )}
                  {filteredTransactions.map((tItem, i) => (
                    <div
                      key={tItem.id}
                      className="flex items-center px-3 py-2.5"
                      style={{ borderBottom: i < filteredTransactions.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}
                    >
                      <span className="text-[11px] flex-[1.2]" style={{ color: COLORS.navy, ...latinFont }}>
                        {tItem.transaction_date}
                      </span>
                      <div className="flex-[2] pr-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: COLORS.navy }}>
                          {tItem.description}
                        </p>
                        {tItem.transaction_categories && (
                          <span
                            className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                            style={{
                              backgroundColor: (tItem.transaction_categories.color || COLORS.muted) + '20',
                              color: tItem.transaction_categories.color || COLORS.muted,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tItem.transaction_categories.color || COLORS.muted }} />
                            {tItem.transaction_categories.name}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] flex-1 text-center" style={{ color: COLORS.muted }}>
                        {tItem.quantity} {tItem.unit}
                      </span>
                      <span
                        className="text-[11px] font-bold flex-[1.3] text-right"
                        style={{ color: tItem.type === 'income' ? COLORS.success : COLORS.danger, ...latinFont }}
                      >
                        {moneyDisplay(tItem)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================
         INVOICE OVERVIEW (list)
         ============================================ */}
      {currentScreen === 'InvoiceOverview' && profile && (
        <InvoiceOverview
          lang={lang}
          onBack={() => setCurrentScreen('Home')}
          onEditInvoice={(id) => {
            setEditInvoiceId(id);
            setCurrentScreen('Invoice');
          }}
          onPreviewInvoice={(id) => {
            setEditInvoiceId(id);
            setCurrentScreen('Invoice');
          }}
          onCreateInvoice={() => {
            setEditInvoiceId(null);
            setCurrentScreen('Invoice');
          }}
        />
      )}

      {/* ============================================
         INVOICE (create / edit / preview)
         ============================================ */}
      {currentScreen === 'Invoice' && profile && (
        <InvoiceScreen
          lang={lang}
          profile={profile}
          onBack={() => {
            setEditInvoiceId(null);
            setCurrentScreen('InvoiceOverview');
          }}
          editInvoiceId={editInvoiceId}
        />
      )}

      {/* ============================================
         STOCK
         ============================================ */}
      {currentScreen === 'Stock' && profile && (
        <StockScreen lang={lang} onBack={() => setCurrentScreen('Home')} />
      )}

      {/* ============================================
         ACCOUNT
         ============================================ */}
      {currentScreen === 'Account' && profile && (
        <AccountScreen
          lang={lang}
          profile={profile}
          onBack={() => setCurrentScreen('Home')}
          onLogout={handleLogout}
          onLangToggle={() => setLang(lang === 'KH' ? 'EN' : 'KH')}
          onProfileUpdated={(p) => setProfile(p)}
          onOpenSubscription={() => setShowSubscription(true)}
        />
      )}

      {/* ============================================
         REPORT
         ============================================ */}
      {currentScreen === 'Report' && profile && (
        <ReportScreen lang={lang} profile={profile} onBack={() => setCurrentScreen('Home')} />
      )}

      {/* ============================================
         CUSTOMER
         ============================================ */}
      {currentScreen === 'Customer' && profile && (
        <CustomerScreen lang={lang} onBack={() => setCurrentScreen('Home')} />
      )}

      {/* ============================================
         CATEGORY
         ============================================ */}
      {currentScreen === 'Category' && profile && (
        <CategoryScreen lang={lang} onBack={() => setCurrentScreen('Home')} />
      )}

      {showSubscription && profile && (
        <SubscriptionModal
          lang={lang}
          profile={profile}
          trialDaysRemaining={trialDaysRemaining}
          onClose={() => setShowSubscription(false)}
          onOpenTelegram={openTelegram}
        />
      )}
    </div>
  );
}
