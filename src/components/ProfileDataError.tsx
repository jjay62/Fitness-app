'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export function ProfileDataError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
      <AlertCircle className="text-amber-400" size={40} />
      <p className="text-gray-200 font-medium">Could not load your profile</p>
      <p className="text-sm text-gray-500 max-w-md">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
