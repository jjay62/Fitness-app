'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import { LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UserNav() {
  const { user, signOut } = useAuth();
  const { profile } = useApp();
  const { t } = useLocale();
  if (!user) return null;

  // Fallback logic for metadata (Social logins)
  const metadata = user.user_metadata || {};
  const displayName = profile?.username || metadata.username || metadata.full_name || metadata.name || t('userNav.newUser');
  const displayAvatar = profile?.avatar_url || metadata.avatar_url || metadata.picture;
  const initials = String(displayName)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 overflow-hidden bg-white/5 flex items-center justify-center">
          {displayAvatar ? (
            <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-blue-300">{initials}</span>
          )}
        </div>
        <div>
          <h3 className="text-foreground font-bold leading-none mb-1">
            {displayName}
          </h3>
          <p className="text-[10px] text-muted font-medium lowercase">
            {user.email}
          </p>
        </div>
      </div>

      <button
        onClick={() => signOut()}
        className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        title={t('userNav.signOut')}
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}
