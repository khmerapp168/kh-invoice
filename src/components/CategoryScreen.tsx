import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Tag,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { IconBadge } from './IconBadge';
import { COLORS, latinFont, INLINE, ACTION } from '../lib/theme';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  created_at: string;
}

interface Props {
  lang: 'KH' | 'EN';
  onBack: () => void;
}

const PALETTE = ['#0C447C', '#1F9D6B', '#E5533D', '#E0A93E', '#2E86C1', '#0F6E56', '#C98F1F', '#6B7B8A'];

const inputStyle: CSSProperties = {
  borderColor: COLORS.border,
  backgroundColor: '#FFFFFF',
  color: COLORS.navy,
};

const DEFAULT_EXPENSE = ['Rent', 'Electricity', 'Water', 'Salary', 'Marketing', 'Transport', 'Supplies', 'Other'];
const DEFAULT_INCOME = ['Sales', 'Service', 'Other'];

export default function CategoryScreen({ lang, onBack }: Props) {
  const tr = (kh: string, en: string) => (lang === 'KH' ? kh : en);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expense' | 'income'>('expense');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(PALETTE[0]);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transaction_categories')
      .select('id, name, type, color, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    } else {
      setCategories((data as Category[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filtered = useMemo(() => categories.filter((c) => c.type === tab), [categories, tab]);

  const openAddForm = () => {
    setEditTarget(null);
    setFormName('');
    setFormColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (c: Category) => {
    setEditTarget(c);
    setFormName(c.name);
    setFormColor(c.color || PALETTE[0]);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) {
      setFormError(tr('សូមបញ្ចូលឈ្មោះប្រភេទ', 'Please enter a category name'));
      return;
    }
    setFormBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    if (editTarget) {
      const { error } = await supabase
        .from('transaction_categories')
        .update({ name: formName.trim(), color: formColor })
        .eq('id', editTarget.id);
      setFormBusy(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('transaction_categories').insert({
        user_id: userData.user?.id,
        name: formName.trim(),
        type: tab,
        color: formColor,
      });
      setFormBusy(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    }
    setIsFormOpen(false);
    fetchCategories();
  };

  const handleSeedDefaults = async () => {
    const { data: userData } = await supabase.auth.getUser();
    type DefaultRow = { user_id: string | undefined; name: string; type: 'income' | 'expense'; color: string };
    const defaults: DefaultRow[] =
      tab === 'expense'
        ? DEFAULT_EXPENSE.map((name, i) => ({
            user_id: userData.user?.id,
            name,
            type: 'expense' as const,
            color: PALETTE[i % PALETTE.length],
          }))
        : DEFAULT_INCOME.map((name, i) => ({
            user_id: userData.user?.id,
            name,
            type: 'income' as const,
            color: PALETTE[i % PALETTE.length],
          }));
    await supabase.from('transaction_categories').upsert(defaults, { onConflict: 'user_id,name,type' });
    fetchCategories();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    await supabase.from('transaction_categories').delete().eq('id', deleteTarget.id);
    setDeleteBusy(false);
    setDeleteTarget(null);
    fetchCategories();
  };

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
          <p className="text-white font-bold text-base">{tr('ប្រភេទចំណូល/ចំណាយ', 'Categories')}</p>
          <p className="text-white/70 text-xs">{tr('ចាប់ចំណាយតាមប្រភេទ', 'Track expenses by category')}</p>
        </div>
        <button
          onClick={openAddForm}
          aria-label={tr('បន្ថែមប្រភេទ', 'Add category')}
          className="flex items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <Plus size={INLINE} color="#FFFFFF" strokeWidth={2.5} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3.5 pt-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('expense')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold"
            style={{
              borderColor: COLORS.border,
              backgroundColor: tab === 'expense' ? COLORS.danger : '#FFFFFF',
              color: tab === 'expense' ? '#FFFFFF' : COLORS.navy,
            }}
          >
            <TrendingDown size={14} color={tab === 'expense' ? '#FFFFFF' : COLORS.navy} strokeWidth={2.5} />
            {tr('ចំណាយ', 'Expense')}
          </button>
          <button
            onClick={() => setTab('income')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold"
            style={{
              borderColor: COLORS.border,
              backgroundColor: tab === 'income' ? COLORS.success : '#FFFFFF',
              color: tab === 'income' ? '#FFFFFF' : COLORS.navy,
            }}
          >
            <TrendingUp size={14} color={tab === 'income' ? '#FFFFFF' : COLORS.navy} strokeWidth={2.5} />
            {tr('ចំណូល', 'Income')}
          </button>
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
              <IconBadge icon={Tag} size={ACTION} tint="navy" shape="rounded" className="mx-auto" />
              <p className="text-xs mt-3" style={{ color: COLORS.muted }}>
                {tr('មិនទាន់មានប្រភេទនៅឡើយ', 'No categories yet')}
              </p>
              <button
                onClick={handleSeedDefaults}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: COLORS.gold }}
              >
                <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                {tr('បន្ថែមប្រភេទស្តង់ដារ', 'Add Default Categories')}
              </button>
            </div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className="w-full flex items-center bg-white rounded-2xl px-3.5 py-3 mb-2"
              style={{ boxShadow: '0 2px 8px rgba(12,68,124,0.08)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (c.color || COLORS.navy) + '20' }}
              >
                <Tag size={16} color={c.color || COLORS.navy} strokeWidth={2.5} />
              </div>
              <p className="flex-1 min-w-0 ml-3 text-sm font-bold truncate" style={{ color: COLORS.navy }}>
                {c.name}
              </p>
              <button
                onClick={() => openEditForm(c)}
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.navyTint }}
              >
                <Pencil size={15} color={COLORS.navy} strokeWidth={2} />
              </button>
              <button
                onClick={() => setDeleteTarget(c)}
                className="flex items-center justify-center flex-shrink-0 ml-2"
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.dangerTint }}
              >
                <Trash2 size={15} color={COLORS.danger} strokeWidth={2} />
              </button>
            </div>
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
              <IconBadge icon={Tag} size={INLINE} tint={tab === 'expense' ? 'danger' : 'success'} shape="rounded" />
              <h3 className="text-base font-bold" style={{ color: COLORS.navy }}>
                {editTarget ? tr('កែប្រភេទ', 'Edit Category') : tr('ប្រភេទថ្មី', 'New Category')}
              </h3>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
                style={{
                  backgroundColor: tab === 'expense' ? COLORS.dangerTint : COLORS.successTint,
                  color: tab === 'expense' ? COLORS.danger : COLORS.success,
                }}
              >
                {tab === 'expense' ? tr('ចំណាយ', 'Expense') : tr('ចំណូល', 'Income')}
              </span>
            </div>

            <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.navy }}>
              {tr('ឈ្មោះប្រភេទ', 'Category Name')} *
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={tr('ឧ. ជួល', 'e.g. Rent')}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none mb-4"
              style={inputStyle}
            />

            <label className="text-xs font-semibold block mb-2" style={{ color: COLORS.navy }}>
              {tr('ពណ៌', 'Color')}
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormColor(color)}
                  className="rounded-full flex items-center justify-center transition-transform"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: color,
                    border: formColor === color ? `3px solid ${COLORS.navy}` : '3px solid transparent',
                    transform: formColor === color ? 'scale(1.1)' : 'none',
                  }}
                >
                  {formColor === color && <X size={14} color="#FFFFFF" strokeWidth={3} className="rotate-45" />}
                </button>
              ))}
            </div>

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
              {tr('លុបប្រភេទ?', 'Delete Category?')}
            </p>
            <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
              {tr('ប្រតិបត្តិការដែលបានប្រភេទនេះនឹងនៅដដែល ប៉ុន្តែប្រភេទនឹងត្រូវបានលុប។', 'Transactions keep their data, only the category is removed.')}
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
