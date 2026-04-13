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

export default function Library() {
  const { user, loading: authLoading } = useAuth();
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
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FoodItem | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'];

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
    alert(`Logged ${item.name}!`);
  };

  const startEdit = (item: FoodItem) => {
    if (!item.id) {
      alert('This item cannot be edited (no id). Re-add it from the tracker.');
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
    if (!window.confirm(`Remove "${item.name}" from your library?`)) return;
    void deleteFoodLibraryItem(item.id);
    if (expandedId === item.id) cancelEdit();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-4">
      <UserNav />
      <header className="flex justify-between items-center">
        <h1 className="page-title">Library</h1>
      </header>

      <div className="flex gap-4">
        <div className="flex-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              className="input-field pl-10"
              placeholder="Search foods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`snap-center shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-white/5 border border-white/10 text-gray-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3 mt-4">
            <AnimatePresence>
              {filteredLibrary.length === 0 ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-400 text-sm text-center mt-8">
                  No items found. Scan some foods to add them here!
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
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 flex items-center gap-1 text-gray-300">
                            <Tag size={10} /> {item.category || 'Uncategorized'}
                          </span>
                          <p className="text-xs text-blue-400 font-medium">{item.kcal} kcal</p>
                          <p className="text-[10px] text-gray-500">
                            P{item.protein} C{item.carbs} F{item.fats} Fi{item.fiber ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title="Log to today"
                          onClick={() => handleLog(item)}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => (expandedId === item.id ? cancelEdit() : startEdit(item))}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => handleDelete(item)}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {expandedId === item.id && draft && (
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase font-bold">Name</label>
                          <input
                            className="input-field mt-1"
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase font-bold">Category</label>
                          <select
                            className="input-field mt-1 appearance-none"
                            value={draft.category || 'Snack'}
                            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                          >
                            {categories
                              .filter((c) => c !== 'All')
                              .map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              ['kcal', 'Calories'],
                              ['protein', 'Protein (g)'],
                              ['carbs', 'Carbs (g)'],
                              ['fats', 'Fats (g)'],
                              ['fiber', 'Fiber (g)'],
                            ] as const
                          ).map(([key, label]) => (
                            <div key={key}>
                              <label className="text-[10px] text-gray-500 uppercase font-bold">{label}</label>
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
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="btn-secondary flex-1 py-2 flex items-center justify-center gap-2 rounded-xl border-white/10"
                          >
                            <X size={18} />
                            Cancel
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
