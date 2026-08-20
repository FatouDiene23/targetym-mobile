'use client';

import { Sparkles } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCopilotAccess } from '@/hooks/useCopilotAccess';

export default function CopilotLauncher() {
  const router = useRouter();
  const pathname = usePathname();
  const { canSeeCopilot, checked } = useCopilotAccess();

  if (!checked || !canSeeCopilot || pathname.startsWith('/dashboard/copilot')) return null;

  return (
    <button
      type="button"
      onClick={() => router.push('/dashboard/copilot')}
      className="fixed bottom-24 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-xl transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
      aria-label="Ouvrir Copilote AI"
    >
      <Sparkles size={25} />
      <span className="absolute -right-1 -top-1 rounded-full border-2 border-white bg-secondary-500 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide">BETA</span>
    </button>
  );
}
