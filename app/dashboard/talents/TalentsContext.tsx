// ============================================
// app/dashboard/talents/TalentsContext.tsx
// Context provider with state, data fetching, actions
// ============================================

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  CareerPath, CareerLevel, LevelCompetency, PromotionFactor,
  EmployeeCareer, CompetencyProgress, PromotionRequest,
  NineBoxData, NineBoxPlacement,
  SuccessionPlan, SuccessionCandidate,
  Attitude, DashboardData,
  apiFetch, getUserRole, isRH, isManager
} from './shared';

// ============================================
// CONTEXT TYPE
// ============================================

interface TalentsContextType {
  // State
  loading: boolean;
  error: string | null;
  userRole: string;

  // Dashboard
  dashboard: DashboardData | null;
  loadDashboard: () => Promise<void>;

  // Career Paths
  paths: CareerPath[];
  selectedPath: (CareerPath & { levels?: CareerLevel[] }) | null;
  loadPaths: () => Promise<void>;
  loadPathDetail: (id: number) => Promise<void>;
  createPath: (name: string, description?: string) => Promise<void>;
  updatePath: (id: number, data: Partial<CareerPath>) => Promise<void>;
  deletePath: (id: number) => Promise<void>;
  duplicatePath: (id: number) => Promise<void>;

  // Career Levels
  createLevel: (pathId: number, data: any) => Promise<void>;
  updateLevel: (id: number, data: any) => Promise<void>;
  deleteLevel: (id: number) => Promise<void>;
  reorderLevels: (pathId: number, orders: { id: number; level_order: number }[]) => Promise<void>;

  // Competencies
  createCompetency: (levelId: number, data: any) => Promise<void>;
  updateCompetency: (id: number, data: any) => Promise<void>;
  deleteCompetency: (id: number) => Promise<void>;
  linkTrainings: (compId: number, courseIds: number[]) => Promise<void>;

  // Attitudes & Factors
  attitudes: Attitude[];
  loadAttitudes: () => Promise<void>;
  linkAttitudes: (levelId: number, attitudeIds: number[], threshold?: number) => Promise<void>;
  createFactor: (levelId: number, data: any) => Promise<void>;
  updateFactor: (id: number, data: any) => Promise<void>;
  deleteFactor: (id: number) => Promise<void>;

  // Employee Careers
  employeeCareers: EmployeeCareer[];
  loadEmployeeCareers: (pathId?: number, eligibility?: string, search?: string, managerId?: number) => Promise<void>;
  teamCareers: EmployeeCareer[];
  loadTeamCareers: (managerId?: number, eligibility?: string, search?: string) => Promise<void>;
  assignEmployee: (employeeId: number, pathId: number, levelId: number) => Promise<void>;
  assignBulk: (employeeIds: number[], pathId: number, levelId: number) => Promise<void>;
  loadEmployeeCareerDetail: (employeeId: number) => Promise<any>;
  syncProgress: (employeeId: number) => Promise<void>;
  syncAllProgress: () => Promise<void>;
  unassignCareer: (employeeId: number, pathId: number) => Promise<void>;

  // Promotions
  promotions: PromotionRequest[];
  loadPromotions: (status?: string) => Promise<void>;
  requestPromotion: (ecId: number, comments?: string) => Promise<void>;
  decidePromotion: (reqId: number, status: 'approved' | 'rejected', comments?: string, committee?: string) => Promise<void>;
  cancelPromotion: (reqId: number) => Promise<void>;

  // Nine-Box
  nineBoxData: NineBoxData | null;
  loadNineBox: (period?: string, department?: string) => Promise<void>;
  createNineBoxPlacement: (data: any) => Promise<void>;
  bulkNineBoxPlacements: (period: string, placements: any[]) => Promise<void>;

  // Succession
  successionPlans: SuccessionPlan[];
  selectedPlan: SuccessionPlan | null;
  loadSuccessionPlans: (criticality?: string) => Promise<void>;
  loadPlanDetail: (id: number) => Promise<void>;
  createSuccessionPlan: (data: any) => Promise<void>;
  updateSuccessionPlan: (id: number, data: any) => Promise<void>;
  deleteSuccessionPlan: (id: number) => Promise<void>;
  addCandidate: (planId: number, data: any) => Promise<void>;
  updateCandidate: (id: number, data: any) => Promise<void>;
  removeCandidate: (id: number) => Promise<void>;
}

const TalentsContext = createContext<TalentsContextType | null>(null);

export function useTalents(): TalentsContextType {
  const ctx = useContext(TalentsContext);
  if (!ctx) throw new Error('useTalents must be used within TalentsProvider');
  return ctx;
}

// ============================================
// PROVIDER
// ============================================

export function TalentsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('employee');

  // Data state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<any>(null);
  const [attitudes, setAttitudes] = useState<Attitude[]>([]);
  const [employeeCareers, setEmployeeCareers] = useState<EmployeeCareer[]>([]);
  const [teamCareers, setTeamCareers] = useState<EmployeeCareer[]>([]);
  const [promotions, setPromotions] = useState<PromotionRequest[]>([]);
  const [nineBoxData, setNineBoxData] = useState<NineBoxData | null>(null);
  const [successionPlans, setSuccessionPlans] = useState<SuccessionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SuccessionPlan | null>(null);

  // Init
  useEffect(() => {
    const role = getUserRole();
    setUserRole(role);
    if (['rh', 'admin', 'directeur', 'manager', 'dg', 'dga'].includes(role)) {
      loadDashboard().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ============================================
  // DASHBOARD
  // ============================================

  const loadDashboard = useCallback(async () => {
    try {
      const data = await apiFetch('/api/careers/dashboard');
      setDashboard(data);
    } catch (e: any) {
      console.error('Dashboard error:', e);
    }
  }, []);

  // ============================================
  // CAREER PATHS
  // ============================================

  const loadPaths = useCallback(async () => {
    try {
      const data = await apiFetch('/api/careers/paths');
      setPaths(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const loadPathDetail = useCallback(async (id: number) => {
    try {
      const data = await apiFetch(`/api/careers/paths/${id}`);
      setSelectedPath(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const createPath = useCallback(async (name: string, description?: string) => {
    await apiFetch('/api/careers/paths', {
      method: 'POST', body: JSON.stringify({ name, description })
    });
    await loadPaths();
  }, [loadPaths]);

  const updatePath = useCallback(async (id: number, data: Partial<CareerPath>) => {
    await apiFetch(`/api/careers/paths/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    await loadPaths();
    if (selectedPath?.id === id) await loadPathDetail(id);
  }, [loadPaths, loadPathDetail, selectedPath]);

  const deletePath = useCallback(async (id: number) => {
    await apiFetch(`/api/careers/paths/${id}`, { method: 'DELETE' });
    setSelectedPath(null);
    await loadPaths();
  }, [loadPaths]);

  const duplicatePath = useCallback(async (id: number) => {
    await apiFetch(`/api/careers/paths/${id}/duplicate`, { method: 'POST' });
    await loadPaths();
  }, [loadPaths]);

  // ============================================
  // CAREER LEVELS
  // ============================================

  const createLevel = useCallback(async (pathId: number, data: any) => {
    await apiFetch(`/api/careers/paths/${pathId}/levels`, {
      method: 'POST', body: JSON.stringify(data)
    });
    await loadPathDetail(pathId);
  }, [loadPathDetail]);

  const updateLevel = useCallback(async (id: number, data: any) => {
    await apiFetch(`/api/careers/levels/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const deleteLevel = useCallback(async (id: number) => {
    await apiFetch(`/api/careers/levels/${id}`, { method: 'DELETE' });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const reorderLevels = useCallback(async (pathId: number, orders: { id: number; level_order: number }[]) => {
    await apiFetch(`/api/careers/paths/${pathId}/levels/reorder`, {
      method: 'PUT', body: JSON.stringify(orders)
    });
    await loadPathDetail(pathId);
  }, [loadPathDetail]);

  // ============================================
  // COMPETENCIES
  // ============================================

  const createCompetency = useCallback(async (levelId: number, data: any) => {
    await apiFetch(`/api/careers/levels/${levelId}/competencies`, {
      method: 'POST', body: JSON.stringify(data)
    });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const updateCompetency = useCallback(async (id: number, data: any) => {
    await apiFetch(`/api/careers/competencies/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const deleteCompetency = useCallback(async (id: number) => {
    await apiFetch(`/api/careers/competencies/${id}`, { method: 'DELETE' });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const linkTrainings = useCallback(async (compId: number, courseIds: number[]) => {
    await apiFetch(`/api/careers/competencies/${compId}/trainings`, {
      method: 'POST', body: JSON.stringify({ course_ids: courseIds })
    });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  // ============================================
  // ATTITUDES & FACTORS
  // ============================================

  const loadAttitudes = useCallback(async () => {
    try {
      const data = await apiFetch('/api/careers/attitudes');
      setAttitudes(data);
    } catch (e: any) { console.error(e); }
  }, []);

  const linkAttitudes = useCallback(async (levelId: number, attitudeIds: number[], threshold = 95) => {
    await apiFetch(`/api/careers/levels/${levelId}/attitudes`, {
      method: 'POST', body: JSON.stringify({ attitude_ids: attitudeIds, threshold })
    });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const createFactor = useCallback(async (levelId: number, data: any) => {
    await apiFetch(`/api/careers/levels/${levelId}/factors`, {
      method: 'POST', body: JSON.stringify(data)
    });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const updateFactor = useCallback(async (id: number, data: any) => {
    await apiFetch(`/api/careers/factors/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  const deleteFactor = useCallback(async (id: number) => {
    await apiFetch(`/api/careers/factors/${id}`, { method: 'DELETE' });
    if (selectedPath) await loadPathDetail(selectedPath.id);
  }, [loadPathDetail, selectedPath]);

  // ============================================
  // EMPLOYEE CAREERS
  // ============================================

  const loadEmployeeCareers = useCallback(async (pathId?: number, eligibility?: string, search?: string, managerId?: number) => {
    try {
      const params = new URLSearchParams();
      if (pathId) params.set('path_id', String(pathId));
      if (eligibility) params.set('eligibility', eligibility);
      if (search) params.set('search', search);
      if (managerId) params.set('manager_id', String(managerId));
      const data = await apiFetch(`/api/careers/employees/all?${params}`);
      setEmployeeCareers(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const loadTeamCareers = useCallback(async (managerId?: number, eligibility?: string, search?: string) => {
    try {
      const params = new URLSearchParams();
      if (managerId) params.set('manager_id', String(managerId));
      if (eligibility) params.set('eligibility', eligibility);
      if (search) params.set('search', search);
      const data = await apiFetch(`/api/careers/employees/all?${params}`);
      setTeamCareers(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const assignEmployee = useCallback(async (employeeId: number, pathId: number, levelId: number) => {
    await apiFetch('/api/careers/employees/assign', {
      method: 'POST', body: JSON.stringify({ employee_id: employeeId, career_path_id: pathId, level_id: levelId })
    });
  }, []);

  const assignBulk = useCallback(async (employeeIds: number[], pathId: number, levelId: number) => {
    await apiFetch('/api/careers/employees/assign-bulk', {
      method: 'POST', body: JSON.stringify({ employee_ids: employeeIds, career_path_id: pathId, level_id: levelId })
    });
  }, []);

  const loadEmployeeCareerDetail = useCallback(async (employeeId: number) => {
    return await apiFetch(`/api/careers/employees/${employeeId}/career`);
  }, []);

  const syncProgress = useCallback(async (employeeId: number) => {
    await apiFetch(`/api/careers/employees/${employeeId}/sync-progress`, { method: 'POST' });
  }, []);

  const syncAllProgress = useCallback(async () => {
    await apiFetch('/api/careers/employees/sync-all', { method: 'POST' });
  }, []);

  const unassignCareer = useCallback(async (employeeId: number, pathId: number) => {
    await apiFetch(`/api/careers/employees/${employeeId}/career/${pathId}`, { method: 'DELETE' });
  }, []);

  // ============================================
  // PROMOTIONS
  // ============================================

  const loadPromotions = useCallback(async (status?: string) => {
    try {
      const params = status ? `?status=${status}` : '';
      const data = await apiFetch(`/api/careers/promotions${params}`);
      setPromotions(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const requestPromotion = useCallback(async (ecId: number, comments?: string) => {
    await apiFetch('/api/careers/promotions/request', {
      method: 'POST', body: JSON.stringify({ employee_career_id: ecId, comments })
    });
    await loadPromotions();
  }, [loadPromotions]);

  const decidePromotion = useCallback(async (reqId: number, status: 'approved' | 'rejected', comments?: string, committee?: string) => {
    await apiFetch(`/api/careers/promotions/${reqId}/decide`, {
      method: 'PUT', body: JSON.stringify({ status, comments, committee_decision: committee })
    });
    await loadPromotions();
  }, [loadPromotions]);

  const cancelPromotion = useCallback(async (reqId: number) => {
    await apiFetch(`/api/careers/promotions/${reqId}`, { method: 'DELETE' });
    await loadPromotions();
  }, [loadPromotions]);

  // ============================================
  // NINE-BOX
  // ============================================

  const loadNineBox = useCallback(async (period?: string, department?: string) => {
    try {
      const params = new URLSearchParams();
      if (period) params.set('period', period);
      if (department) params.set('department', department);
      const data = await apiFetch(`/api/careers/ninebox?${params}`);
      setNineBoxData(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const createNineBoxPlacement = useCallback(async (data: any) => {
    await apiFetch('/api/careers/ninebox', { method: 'POST', body: JSON.stringify(data) });
  }, []);

  const bulkNineBoxPlacements = useCallback(async (period: string, placements: any[]) => {
    await apiFetch('/api/careers/ninebox/bulk', {
      method: 'POST', body: JSON.stringify({ period, placements })
    });
  }, []);

  // ============================================
  // SUCCESSION
  // ============================================

  const loadSuccessionPlans = useCallback(async (criticality?: string) => {
    try {
      const params = criticality ? `?criticality=${criticality}` : '';
      const data = await apiFetch(`/api/careers/succession${params}`);
      setSuccessionPlans(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const loadPlanDetail = useCallback(async (id: number) => {
    try {
      const data = await apiFetch(`/api/careers/succession/${id}`);
      setSelectedPlan(data);
    } catch (e: any) { setError(e.message); }
  }, []);

  const createSuccessionPlan = useCallback(async (data: any) => {
    await apiFetch('/api/careers/succession', { method: 'POST', body: JSON.stringify(data) });
    await loadSuccessionPlans();
  }, [loadSuccessionPlans]);

  const updateSuccessionPlan = useCallback(async (id: number, data: any) => {
    await apiFetch(`/api/careers/succession/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await loadSuccessionPlans();
    if (selectedPlan?.id === id) await loadPlanDetail(id);
  }, [loadSuccessionPlans, loadPlanDetail, selectedPlan]);

  const deleteSuccessionPlan = useCallback(async (id: number) => {
    await apiFetch(`/api/careers/succession/${id}`, { method: 'DELETE' });
    setSelectedPlan(null);
    await loadSuccessionPlans();
  }, [loadSuccessionPlans]);

  const addCandidate = useCallback(async (planId: number, data: any) => {
    await apiFetch(`/api/careers/succession/${planId}/candidates`, {
      method: 'POST', body: JSON.stringify(data)
    });
    await loadPlanDetail(planId);
  }, [loadPlanDetail]);

  const updateCandidate = useCallback(async (id: number, data: any) => {
    await apiFetch(`/api/careers/succession/candidates/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    if (selectedPlan) await loadPlanDetail(selectedPlan.id);
  }, [loadPlanDetail, selectedPlan]);

  const removeCandidate = useCallback(async (id: number) => {
    await apiFetch(`/api/careers/succession/candidates/${id}`, { method: 'DELETE' });
    if (selectedPlan) await loadPlanDetail(selectedPlan.id);
  }, [loadPlanDetail, selectedPlan]);

  // ============================================
  // VALUE
  // ============================================

  const value: TalentsContextType = {
    loading, error, userRole,
    dashboard, loadDashboard,
    paths, selectedPath, loadPaths, loadPathDetail, createPath, updatePath, deletePath, duplicatePath,
    createLevel, updateLevel, deleteLevel, reorderLevels,
    createCompetency, updateCompetency, deleteCompetency, linkTrainings,
    attitudes, loadAttitudes, linkAttitudes, createFactor, updateFactor, deleteFactor,
    employeeCareers, loadEmployeeCareers, teamCareers, loadTeamCareers, assignEmployee, assignBulk,
    loadEmployeeCareerDetail, syncProgress, syncAllProgress, unassignCareer,
    promotions, loadPromotions, requestPromotion, decidePromotion, cancelPromotion,
    nineBoxData, loadNineBox, createNineBoxPlacement, bulkNineBoxPlacements,
    successionPlans, selectedPlan, loadSuccessionPlans, loadPlanDetail,
    createSuccessionPlan, updateSuccessionPlan, deleteSuccessionPlan,
    addCandidate, updateCandidate, removeCandidate,
  };

  return <TalentsContext.Provider value={value}>{children}</TalentsContext.Provider>;
}
