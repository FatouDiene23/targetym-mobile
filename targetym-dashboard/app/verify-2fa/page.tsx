'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, ArrowLeft, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

export default function Verify2FAPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const needs = localStorage.getItem('2fa_needs_setup');
    if (needs === 'true') {
      setNeedsSetup(true);
      setup2FA();
    }
    // Focus premier input
    inputRefs.current[0]?.focus();
  }, []);

  const setup2FA = async () => {
    try {
      const tempToken = localStorage.getItem('2fa_temp_token');
      if (!tempToken) return;

      const res = await fetch(`${API_URL}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setQrCode(data.qr_code || data.qr_code_base64 || '');
      }
    } catch {
      setError('Erreur lors de la configuration 2FA.');
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus prochain input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Soumettre automatiquement quand les 6 chiffres sont remplis
    if (index === 5 && value) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length === 6) {
      handleVerify(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeStr = fullCode || code.join('');
    if (codeStr.length !== 6) {
      setError('Veuillez entrer les 6 chiffres.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const tempToken = localStorage.getItem('2fa_temp_token');
      if (!tempToken) {
        setError('Session expirée. Veuillez vous reconnecter.');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`,
        },
        body: JSON.stringify({ code: codeStr }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Code invalide ou expiré.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // Stocker les vrais tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      // Nettoyer les données 2FA temporaires
      localStorage.removeItem('2fa_temp_token');
      localStorage.removeItem('2fa_needs_setup');

      // Rediriger vers le dashboard
      const userRole = data.user?.role || '';
      const isPlatformAdmin = ['superadmin', 'super_admin', 'superadmintech', 'platform_admin'].includes(
        userRole.toLowerCase().replace(/[^a-z_]/g, '')
      );
      window.location.replace(isPlatformAdmin ? '/dashboard/platform-admin/index.html' : '/dashboard/index.html');
    } catch {
      setError('Impossible de se connecter au serveur.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Vérification 2FA</h1>
          <p className="text-gray-500 mt-1">
            {needsSetup
              ? 'Scannez le QR code avec votre application d\'authentification'
              : 'Entrez le code à 6 chiffres de votre application'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {/* QR Code pour le setup initial */}
          {needsSetup && qrCode && (
            <div className="text-center mb-6">
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code 2FA"
                className="mx-auto w-48 h-48 border border-gray-200 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-2">
                Scannez avec Google Authenticator ou Authy
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Code input - 6 digits */}
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900"
              />
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={() => handleVerify()}
            disabled={loading || code.join('').length !== 6}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Vérification...
              </div>
            ) : (
              'Vérifier'
            )}
          </button>

          <div className="mt-6 text-center">
            <a
              href="/login/index.html"
              className="inline-flex items-center text-sm text-blue-600 font-medium hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour à la connexion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
