'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import AbsencesTab from '@/components/AbsencesTab';
import { API_URL, fetchWithAuth } from '@/lib/api';

interface CurrentUser {
  employee_id?: number;
  has_manager_access?: boolean;
}

interface TeamMember {
  id: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

async function loadTeam(): Promise<TeamMember[]> {
  const userResponse = await fetchWithAuth(`${API_URL}/api/auth/me`);
  if (!userResponse.ok) throw new Error('Impossible de charger votre profil');
  const user: CurrentUser = await userResponse.json();
  if (!user.employee_id || !user.has_manager_access) {
    throw new Error("Vous n'avez pas d'équipe à superviser");
  }

  const teamResponse = await fetchWithAuth(
    `${API_URL}/api/employees/${user.employee_id}/direct-reports`,
  );
  if (!teamResponse.ok) throw new Error("Impossible de charger votre équipe");
  return teamResponse.json();
}

function TeamAbsencesContent() {
  const searchParams = useSearchParams();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const employeeId = Number(searchParams.get('employee_id')) || undefined;
  const reportId = Number(searchParams.get('report_id')) || undefined;
  const initialDate = searchParams.get('date') || undefined;

  useEffect(() => {
    loadTeam()
      .then(setTeam)
      .catch(error => setError(error instanceof Error ? error.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement de votre équipe...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <AlertCircle className="mx-auto mb-3 h-8 w-8" />
        {error}
      </div>
    );
  }

  return (
    <>
      <Header
        title="Absences et retards de mon équipe"
        subtitle="Constater une situation et suivre son traitement administratif"
      />
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <AbsencesTab
          employeesList={team}
          managerMode
          initialEmployeeId={employeeId}
          initialDate={initialDate}
          highlightedReportId={reportId}
        />
      </div>
    </>
  );
}

export default function TeamAbsencesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement...
        </div>
      }
    >
      <TeamAbsencesContent />
    </Suspense>
  );
}
