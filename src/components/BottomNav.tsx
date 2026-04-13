'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Camera, Book, Settings, Sparkles, Calendar, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Agenda', path: '/agenda', icon: Calendar },
    { name: 'Progress', path: '/progress', icon: TrendingUp },
    { name: 'Tracker', path: '/tracker', icon: Camera },
    { name: 'Suggest', path: '/suggestions', icon: Sparkles },
    { name: 'Library', path: '/library', icon: Book },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-20 bg-[#0b0f19]/85 backdrop-blur-xl border-t border-white/10 z-[100] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="h-full overflow-x-auto overflow-y-hidden scrollbar-none flex items-center px-1">
        <div className="flex min-w-full justify-start sm:justify-between items-center gap-0.5 px-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className="relative flex flex-col items-center gap-0.5 min-w-[3.25rem] shrink-0 px-1 py-1 rounded-xl"
              >
                <motion.div
                  animate={{
                    y: isActive ? -2 : 0,
                    color: isActive ? '#3b82f6' : '#9ca3af',
                  }}
                  className="relative z-10"
                >
                  <Icon size={22} className={isActive ? 'drop-shadow-[0_2px_8px_rgba(59,130,246,0.5)]' : ''} />
                </motion.div>

                <motion.span
                  animate={{ color: isActive ? '#3b82f6' : '#9ca3af' }}
                  className="text-[0.6rem] font-medium z-10 text-center leading-tight max-w-[4.25rem] truncate"
                >
                  {item.name}
                </motion.span>

                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute inset-0 bg-blue-500/10 rounded-xl"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
