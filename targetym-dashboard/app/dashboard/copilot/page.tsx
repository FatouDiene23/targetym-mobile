'use client';

import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import AIChatBox from '@/components/AIChatBox';
import { useCopilotAccess } from '@/hooks/useCopilotAccess';

export default function CopilotPage() {
  const router = useRouter();
  const { canUseCopilot, checked } = useCopilotAccess();

  if (!checked) return <div className="min-h-[60vh] bg-slate-50" />;
  if (!canUseCopilot) return <Forbidden />;

  return (
    <AIChatBox
      initiallyOpen
      hideLauncher
      onClose={() => {
        if (window.history.length > 1) router.back();
        else router.push('/dashboard');
      }}
    />
  );
}

function Forbidden() {
  return <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6 text-center"><div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><ShieldOff className="mx-auto mb-3 text-slate-400" size={30} /><p className="font-medium text-slate-700">Le Copilote n’est pas activé pour votre profil.</p></div></div>;
}