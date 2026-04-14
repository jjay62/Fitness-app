'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import type { FoodItem } from '../../context/AppContext';
import { useRouter } from 'next/navigation';
import { Plus, Search, Tag, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserNav from '../../components/UserNav';
import { ProfileDataError } from '../../components/ProfileDataError';
import { useLocale } from '../../context/LocaleContext';

const CATEGORY_VALUES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'] as const;

function categoryLabel(
  cat: (typeof CATEGORY_VALUES)[number],
  tf: (key: string) => string
) {
  const keys: Record<(typeof CATEGORY_VALUES)[number], string> = {
    All: 'library.catAll',
    Breakfast: 'library.catBreakfast',
    Lunch: 'library.catLunch',
    Dinner: 'library.catDinner',
    Snack: 'library.catSnack',
    Drink: 'library.catDrink',
  };
  return tf(keys[cat]);
}

export default function Library() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const {
    profile,
    foodLibrary,
    addFoodToLog,
    updateFoodLibraryItem,
    deleteFoodLibraryItem,
    dataLoading,
    profileFetchError,
    refetchUserData,
  } = useApp();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORY_VALUES)[number]>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FoodItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !dataLoading && !profileFetchError) {
      if (!user) {
        router.push('/login');
      } else if (profile && !profile.is_setup_complete) {
        router.push('/setup');
      }
    }
  }, [user, profile, authLoading, dataLoading, profileFetchError, router]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (!dataLoading && profileFetchError) {
    return (
      <ProfileDataError message={profileFetchError} onRetry={() => void refetchUserData()} />
    );
  }

  if (dataLoading || !profile?.is_setup_complete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const filteredLibrary = useMemo(() => {
    return foodLibrary.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [foodLibrary, search, selectedCategory]);

  const handleLog = (item: FoodItem) => {
    addFoodToLog(item);
    alert(t('library.logged', { name: item.name }));
  };

  const startEdit = (item: FoodItem) => {
    if (!item.id) {
      alert(t('libraryExtra.noEditId'));
      return;
    }
    setExpandedId(item.id);
    setDraft({ ...item });
  };

  const cancelEdit = () => {
    setExpandedId(null);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await updateFoodLibraryItem(draft.id, {
        name: draft.name,
        category: draft.category,
        kcal: Number(draft.kcal),
        protein: Number(draft.protein),
        carbs: Number(draft.carbs),
        fats: Number(draft.fats),
        fiber: Number(draft.fiber),
      });
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: FoodItem) => {
    if (!item.id) return;
    if (!window.confirm(t('libraryExtra.confirmRemove', { name: item.name }))) return;
    void deleteFoodLibraryItem(item.id);
    if (expandedId === item.id) cancelEdit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 px-4 pb-24 max-w-2xl mx-auto w-full"
    >
      <UserNav />
      <header className="flex justify-between items-center gap-2 min-w-0">
        <h1 className="page-title text-3xl sm:text-4xl truncate">{t('library.title')}</h1>
      </header>

      <div className="flex gap-4 w-full min-w-0">
        <div className="flex-1 space-y-4 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              className="input-field pl-10"
              placeholder={t('library.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x -mx-1 px-1">
            {CATEGORY_VALUES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`snap-center shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-white/5 border border-white/10 text-muted'}`}
              >
                {categoryLabel(cat, t)}
              </button>
            ))}
          </div>

          <div className="space-y-3 mt-4">
            <AnimatePresence>
              {filteredLibrary.length === 0 ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted text-sm text-center mt-8">
                  {t('libraryExtra.noItems')}
                </motion.p>
              ) : (
                filteredLibrary.map((item) => (
                  <motion.div
                    key={item.id ?? item.name}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-panel p-4 space-y-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground break-words">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded border border-[color:var(--glass-border)] bg-white/5 inline-flex items-center gap-1 text-muted shrink-0">
                            <Tag size={10} />{' '}
                            {item.category
                              ? CATEGORY_VALUES.includes(item.category as (typeof CATEGORY_VALUES)[number])
                                ? categoryLabel(item.category as (typeof CATEGORY_VALUES)[number], t)
                                : item.category
                              : t('libraryExtra.uncategorized')}
                          </span>
                          <p className="text-xs text-blue-400 font-medium shrink-0">{item.kcal} kcal</p>
                          <p className="text-[10px] text-muted break-all sm:break-normal w-full sm:w-auto">
                            P{item.protein} C{item.carbs} F{item.fats} Fi{item.fiber ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 sm:shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t border-white/5 sm:border-0">
                        <button
                          type="button"
                          title={t('libraryExtra.logToday')}
                          onClick={() => handleLog(item)}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                        <button
                          type="button"
                          title={t('libraryExtra.edit')}
                          onClick={() => (expandedId === item.id ? cancelEdit() : startEdit(item))}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          title={t('libraryExtra.delete')}
                          onClick={() => handleDelete(item)}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {expandedId === item.id && draft && (
                      <div className="pt-3 border-t border-[color:var(--glass-border)] space-y-3">
                        <div>
                          <label className="text-[10px] text-muted uppercase font-bold">{t('libraryExtra.name')}</label>
                          <input
                            className="input-field mt-1"
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted uppercase font-bold">{t('libraryExtra.category')}</label>
                          <select
                            className="input-field mt-1 appearance-none"
                            value={draft.category || 'Snack'}
                            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                          >
                            {CATEGORY_VALUES.filter((c) => c !== 'All').map((c) => (
                              <option key={c} value={c}>
                                {categoryLabel(c, t)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              ['kcal', 'libraryExtra.formCalories'],
                              ['protein', 'libraryExtra.formProtein'],
                              ['carbs', 'libraryExtra.formCarbs'],
                              ['fats', 'libraryExtra.formFats'],
                              ['fiber', 'libraryExtra.formFiber'],
                            ] as const
                          ).map(([key, labelKey]) => (
                            <div key={key}>
                              <label className="text-[10px] text-muted uppercase font-bold">{t(labelKey)}</label>
                              <input
                                type="number"
                                className="input-field mt-1"
                                value={key === 'fiber' ? Number(draft.fiber ?? 0) : Number(draft[key] ?? 0)}
                                onChange={(e) =>
                                  setDraft({ ...draft, [key]: parseFloat(e.target.value) || 0 })
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveEdit()}
                            className="btn-primary flex-1 py-2 flex items-center justify-center gap-2 rounded-xl"
                          >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            {t('common.save')}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="btn-secondary flex-1 py-2 flex items-center justify-center gap-2 rounded-xl border-[color:var(--glass-border)]"
                          >
                            <X size={18} />
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
