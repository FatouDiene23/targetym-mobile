'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import AppTour from '@/components/AppTour';
import AIChatBox from '@/components/AIChatBox';
import GroupContextSwitcher from '@/components/GroupContextSwitcher';
import { GroupContextProvider } from '@/context/GroupContext';
import { getTourStepsByRole } from '@/components/AppTourSteps';
import { useAppTour } from '@/hooks/useAppTour';
import { HelpMenuProvider, useHelpMenu } from '@/hooks/useHelpMenu';
import { check2FAStatus, setup2FAAuthenticated, verify2FAAuthenticated } from '@/lib/api';
import { Shield, Smartphone } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement...</p>
      </div>
    </div>
  );
}

function TwoFactorSetupModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'loading' | 'scan' | 'verify'>('loading');
  const [qrCode, setQrCode] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setup2FAAuthenticated()
      .then((data) => {
        setQrCode(data.qr_code_base64);
        setStep('scan');
      })
      .catch(() => {
        setError('Erreur lors de la configuration 2FA');
      });
  }, []);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...otpCode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setOtpCode(newCode);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      setError('Veuillez entrer les 6 chiffres');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await verify2FAAuthenticated(code);
      onComplete();
    } catch {
      setError('Code invalide ou expiré. Réessayez.');
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Configuration 2FA requise</h2>
          <p className="text-sm text-gray-500 mt-2">
            Votre entreprise exige l&apos;authentification à deux facteurs.
            Configurez-la pour continuer.
          </p>
        </div>

        {step === 'loading' && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {step === 'scan' && (
          <>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Scannez avec votre app d&apos;authentification</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Google Authenticator, Authy, Microsoft Authenticator...
              </p>
              {qrCode && (
                <div className="flex justify-center">
                  <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
                </div>
              )}
            </div>
            <button
              onClick={() => setStep('verify')}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              J&apos;ai scanné le QR code
            </button>
          </>
        )}

        {step === 'verify' && (
          <>
            <p className="text-sm text-gray-600 text-center mb-4">
              Entrez le code à 6 chiffres de votre application
            </p>
            <div className="flex justify-center gap-2 mb-4" onPaste={handleOtpPaste}>
              {otpCode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                />
              ))}
            </div>
            {error && <p className="text-sm text-red-600 text-center mb-3">{error}</p>}
            <button
              onClick={handleVerify}
              disabled={verifying || otpCode.join('').length !== 6}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {verifying ? 'Vérification...' : 'Vérifier et activer'}
            </button>
            <button
              onClick={() => setStep('scan')}
              className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Revoir le QR code
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needs2FASetup, setNeeds2FASetup] = useState(false);

  // Hook pour gérer le tour applicatif
  const {
    showTour,
    tourCompleted,
    userRole,
    handleCompleteTour,
    handleSkipTour,
    handleRestartTour,
  } = useAppTour();

  // Obtenir les étapes du tour selon le rôle
  const tourSteps = getTourStepsByRole(userRole);

  const check2FA = useCallback(async () => {
    try {
      const status = await check2FAStatus();
      if (status.needs_setup) {
        setNeeds2FASetup(true);
      }
    } catch {
      // Si l'endpoint échoue, on ne bloque pas l'accès
    }
  }, []);

  useEffect(() => {
    // Utiliser window.location.search directement (plus fiable)
    const urlParams = new URLSearchParams(window.location.search);

    const tokenFromUrl = urlParams.get('token');
    const refreshFromUrl = urlParams.get('refresh');
    const userFromUrl = urlParams.get('user');

    console.log('Layout: Token from URL:', tokenFromUrl ? 'EXISTS' : 'NULL');

    if (tokenFromUrl && userFromUrl) {
      // Stocker les tokens
      localStorage.setItem('access_token', tokenFromUrl);
      if (refreshFromUrl) {
        localStorage.setItem('refresh_token', refreshFromUrl);
      }
      try {
        const decodedUser = decodeURIComponent(userFromUrl);
        localStorage.setItem('user', decodedUser);
        console.log('Layout: Tokens stored successfully');
      } catch (e) {
        console.error('Layout: Error decoding user:', e);
      }

      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);

      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // Vérifier localStorage
    const token = localStorage.getItem('access_token');
    console.log('Layout: Token from localStorage:', token ? 'EXISTS' : 'NULL');

    if (!token) {
      console.log('Layout: No token, redirecting to login...');
      window.location.href = 'https://www.targetym.ai/login';
      return;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  // Vérifier 2FA après authentification
  useEffect(() => {
    if (isAuthenticated) {
      check2FA();
    }
  }, [isAuthenticated, check2FA]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <GroupContextProvider>
    <HelpMenuProvider>
      {needs2FASetup && (
        <TwoFactorSetupModal onComplete={() => setNeeds2FASetup(false)} />
      )}
      <DashboardContent
        tourSteps={tourSteps}
        showTour={showTour}
        tourCompleted={tourCompleted}
        handleCompleteTour={handleCompleteTour}
        handleSkipTour={handleSkipTour}
        handleRestartTour={handleRestartTour}
      >
        {children}
      </DashboardContent>
    </HelpMenuProvider>
    </GroupContextProvider>
  );
}

function DashboardContent({
  children,
  tourSteps,
  showTour,
  tourCompleted,
  handleCompleteTour,
  handleSkipTour,
  handleRestartTour,
}: Readonly<{
  children: React.ReactNode;
  tourSteps: any[];
  showTour: boolean;
  tourCompleted: boolean;
  handleCompleteTour: () => void;
  handleSkipTour: () => void;
  handleRestartTour: () => void;
}>) {
  const pathname = usePathname();
  const showGroupContextSwitcher =
    pathname === '/dashboard' || pathname.startsWith('/dashboard/analytics');
  const { setTourHandler } = useHelpMenu();

  // Enregistrer le handler du tour dans le contexte global
  useEffect(() => {
    if (!showTour) {
      setTourHandler(handleRestartTour);
    } else {
      setTourHandler(null);
    }
  }, [showTour, handleRestartTour, setTourHandler]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ImpersonationBanner />
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Bandeau contexte groupe — visible uniquement sur Dashboard et People Analytics */}
        {showGroupContextSwitcher && <GroupContextSwitcher />}
        {children}
      </main>

      {/* Tour Applicatif */}
      <AppTour
        steps={tourSteps}
        isOpen={showTour}
        onComplete={handleCompleteTour}
        onSkip={handleSkipTour}
      />

      {/* Chatbot AI */}
      <AIChatBox />
    </div>
  );
}
