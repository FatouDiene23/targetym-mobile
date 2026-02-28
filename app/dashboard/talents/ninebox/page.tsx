// ============================================
// app/dashboard/talents/ninebox/page.tsx
// Matrice 9-Box interactive
// ============================================

'use client';

import Header from '@/components/Header';
import { useEffect, useState } from 'react';
import { Target, User, Filter, Eye, Edit, ArrowRight, ArrowUpRight, Award } from 'lucide-react';
import { useTalents } from '../TalentsContext';
import {
  NineBoxEmployee, QUADRANT_LABELS, PERFORMANCE_LABELS, POTENTIAL_LABELS,
  getInitials, formatDate, isRH, getUserDepartment
} from '../shared';

export default function NineBoxPage() {
  const { nineBoxData, loadNineBox } = useTalents();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const isRHUser = isRH();

  useEffect(() => {
    const dept = !isRHUser ? (getUserDepartment() || '') : '';
    setSelectedDept(dept);
    loadNineBox(undefined, dept || undefined);
  }, []);

  useEffect(() => {
    if (nineBoxData?.period && !selectedPeriod) {
      setSelectedPeriod(nineBoxData.period);
    }
  }, [nineBoxData]);

  const handleFilterChange = (period?: string, dept?: string) => {
    const p = period !== undefined ? period : selectedPeriod;
    const d = dept !== undefined ? dept : selectedDept;
    if (period !== undefined) setSelectedPeriod(p);
    if (dept !== undefined) setSelectedDept(d);
    loadNineBox(p || undefined, d || undefined);
  };

  const data = nineBoxData;

  // Build 5x5 grid mapping (performance 1-5 x potential 1-5 → quadrant)
  const getQuadrant = (perf: number, pot: number): number => {
    const pBucket = perf >= 4 ? 3 : perf >= 3 ? 2 : 1;
    const potBucket = pot >= 4 ? 3 : pot >= 3 ? 2 : 1;
    return (potBucket - 1) * 3 + pBucket;
  };

  // Get employees for a specific cell in the 5x5 display
  const getCellEmployees = (perf: number, pot: number): NineBoxEmployee[] => {
    if (!data?.placements) return [];
    return data.placements
      .filter(p => Math.round(p.performance_score) === perf && Math.round(p.potential_score) === pot)
      .map(p => ({
        id: p.employee_id,
        name: `${p.first_name} ${p.last_name}`,
        job_title: p.job_title || '',
        photo_url: p.photo_url,
        performance: Number(p.performance_score),
        potential: Number(p.potential_score),
      }));
  };

  return (
    <>
      <Header title="Matrice 9-Box" subtitle="Performance × Potentiel" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={selectedPeriod}
            onChange={e => handleFilterChange(e.target.value, undefined)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Dernière période</option>
            {data?.available_periods?.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {isRHUser ? (
            <select
              value={selectedDept}
              onChange={e => handleFilterChange(undefined, e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Tous les départements</option>
              {data?.available_departments?.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <div className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-500 rounded-full" />
              {getUserDepartment() || 'Mon département'}
            </div>
          )}

          {/* Stats inline */}
          <div className="ml-auto flex gap-4 items-center text-sm">
            <span className="text-gray-500">Total: <strong className="text-gray-900">{data?.total || 0}</strong></span>
            <span className="text-green-600">Stars: <strong>{data?.stats?.stars || 0}</strong></span>
            <span className="text-blue-600">Hauts Pot.: <strong>{data?.stats?.high_potentials || 0}</strong></span>
            <span className="text-red-600">À risque: <strong>{data?.stats?.at_risk || 0}</strong></span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 9-Box Grid */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Matrice Performance × Potentiel</h3>

            <div className="relative">
              {/* Y-axis label */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium text-gray-500 whitespace-nowrap">
                POTENTIEL →
              </div>

              <div className="ml-4">
                <div className="grid grid-cols-6 gap-1">
                  {/* Header: empty + perf labels */}
                  <div className="h-8"></div>
                  {[5, 4, 3, 2, 1].map(p => (
                    <div key={p} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                      {PERFORMANCE_LABELS[p]}
                    </div>
                  ))}

                  {/* Rows: pot label + cells */}
                  {[5, 4, 3, 2, 1].map(pot => (
                    <>
                      <div key={`label-${pot}`} className="h-24 flex items-center justify-end pr-2 text-xs font-medium text-gray-500">
                        {POTENTIAL_LABELS[pot]}
                      </div>
                      {[5, 4, 3, 2, 1].map(perf => {
                        const q = getQuadrant(perf, pot);
                        const info = QUADRANT_LABELS[q];
                        const emps = getCellEmployees(perf, pot);

                        return (
                          <div
                            key={`${perf}-${pot}`}
                            className={`h-24 ${info?.color || 'bg-gray-200'} rounded-lg p-2 flex flex-col justify-between cursor-pointer hover:opacity-90 transition-opacity`}
                            title={`${info?.title}: ${info?.action}`}
                          >
                            <div className="text-white text-xs font-medium truncate">{info?.title}</div>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {emps.slice(0, 4).map(emp => (
                                <div
                                  key={emp.id}
                                  onClick={() => setSelectedEmployee(emp)}
                                  className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-xs font-medium text-gray-700 shadow-sm hover:ring-2 hover:ring-white cursor-pointer"
                                  title={emp.name}
                                >
                                  {getInitials(emp.name.split(' ')[0], emp.name.split(' ')[1])}
                                </div>
                              ))}
                              {emps.length > 4 && (
                                <div className="w-7 h-7 bg-white/50 rounded-full flex items-center justify-center text-xs font-medium text-white">
                                  +{emps.length - 4}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>

                <div className="text-center mt-2 text-sm font-medium text-gray-500">← PERFORMANCE</div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded"></div><span>Stars / Hauts Potentiels</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div><span>Performants Clés</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-500 rounded"></div><span>À Développer</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded"></div><span>Attention Requise</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div><span>Action Urgente</span></div>
            </div>
          </div>

          {/* Selected Employee Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit sticky top-6">
            {selectedEmployee ? (
              <EmployeePanel employee={selectedEmployee} />
            ) : (
              <div className="text-center text-gray-500 py-12">
                <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Cliquez sur un collaborateur dans la matrice pour voir son profil</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

// ============================================
// EMPLOYEE PANEL
// ============================================

function EmployeePanel({ employee }: { employee: NineBoxEmployee }) {
  const { loadEmployeeCareerDetail } = useTalents();
  const [careerData, setCareerData] = useState<any>(null);

  useEffect(() => {
    loadEmployeeCareerDetail(employee.id).then(data => setCareerData(data)).catch(() => {});
  }, [employee.id]);

  const career = careerData?.careers?.[0];

  return (
    <>
      <div className="text-center mb-6">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">
          {getInitials(employee.name.split(' ')[0], employee.name.split(' ')[1])}
        </div>
        <h3 className="text-xl font-bold text-gray-900">{employee.name}</h3>
        <p className="text-sm text-gray-500">{employee.job_title}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-primary-600">{employee.performance}/5</p>
          <p className="text-xs text-gray-500">Performance</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">{employee.potential}/5</p>
          <p className="text-xs text-gray-500">Potentiel</p>
        </div>
      </div>

      {career && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Parcours</p>
            <p className="font-medium text-gray-900">{career.path_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Niveau Actuel</p>
            <p className="font-medium text-gray-900">{career.current_level_title}</p>
          </div>
          {career.next_level_title && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Prochain Niveau</p>
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-primary-500" />
                <span className="font-medium text-gray-900">{career.next_level_title}</span>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Progression</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${career.overall_progress || 0}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">{career.overall_progress || 0}%</span>
            </div>
          </div>

          {career.all_levels && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Parcours Complet</p>
              <div className="flex items-center gap-1 text-xs text-gray-600 flex-wrap">
                {career.all_levels.map((lv: any, i: number) => (
                  <span key={lv.id} className="flex items-center">
                    <span className={lv.id === career.current_level_id ? 'font-bold text-primary-600' : ''}>
                      {lv.title}
                    </span>
                    {i < career.all_levels.length - 1 && <ArrowRight className="w-3 h-3 mx-1 text-gray-400" />}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!career && (
        <p className="text-sm text-gray-400 text-center mt-4">Aucun parcours de carrière assigné</p>
      )}
    </>
  );
}
