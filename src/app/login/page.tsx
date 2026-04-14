'use client';

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Camera, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useLocale } from '@/context/LocaleContext';

export default function LoginPage() {
  const { t } = useLocale();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/');
      } else {
        // Sign Up
        if (!username) throw new Error(t('login.usernameRequired'));

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          let avatarUrl = '';
          if (avatar) {
            const fileExt = avatar.name.split('.').pop();
            const fileName = `${authData.user.id}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, avatar);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
              avatarUrl = publicUrl;
            }
          }

          // Create profile
          const { error: profileError } = await supabase.from('profiles').insert({
            user_id: authData.user.id,
            username,
            avatar_url: avatarUrl,
            is_setup_complete: false,
          });

          if (profileError) throw profileError;

          // Redirect straight to setup instead of email confirmation
          router.push('/setup/physical');
        }
      }
    } catch (err: any) {
      setError(
        err.message === 'Email not confirmed' ? t('login.emailConfirm') : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel w-full max-w-md p-8"
      >
        <div className="text-center mb-8">
          <h1 className="page-title text-4xl mb-2">
            {isLogin ? t('login.welcomeBack') : t('login.createAccount')}
          </h1>
          <p className="text-muted">
            {isLogin ? t('login.signInSubtitle') : t('login.joinSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                key="signup-fields"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Avatar Upload */}
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div
                    className="relative w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={24} className="text-gray-400" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-foreground font-medium uppercase">{t('login.edit')}</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                  />
                  <p className="text-xs text-muted">{t('login.profilePhotoOptional')}</p>
                </div>

                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input-field pl-12"
                    placeholder={t('login.username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              className="input-field pl-12"
              placeholder={t('login.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              className="input-field pl-12"
              placeholder={t('login.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <span className="flex items-center gap-2">
                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                {isLogin ? t('login.signIn') : t('login.signUp')}
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[color:var(--glass-border)] text-center">
          <p className="text-muted text-sm">
            {isLogin ? t('login.noAccount') : t('login.hasAccount')}
            <button
              className="text-blue-500 font-semibold ml-2 hover:underline"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? t('login.createNow') : t('login.signInHere')}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
