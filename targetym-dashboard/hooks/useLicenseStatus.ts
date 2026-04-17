'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLicenseStatus, type LicenseStatus } from '@/lib/api';

export function useLicenseStatus() {
  const [data, setData] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await getLicenseStatus();
      setData(status);
    } catch (err) {
      // Silently fail — don't break the app if endpoint doesn't exist yet
      setError(err instanceof Error ? err.message : 'Erreur');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refresh = useCallback(() => {
    fetch();
  }, [fetch]);

  const hasSurplus = data ? data.surplus > 0 || data.surplus_blocked : false;

  return { data, loading, error, refresh, hasSurplus };
}
