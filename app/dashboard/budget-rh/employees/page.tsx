"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, Search, Filter, Download, ChevronDown, ChevronRight,
  ArrowLeft, Calendar, Building2, Briefcase, DollarSign, Eye,
} from "lucide-react";
import { fetchWithAuth, API_URL } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useBudgetYear } from "@/hooks/useBudgetYear";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Employee {
  employee_id: number;
  first_name: string;
  last_name: string;
  department_name: string;
  job_title: string;
  total_gross: number;
  total_employer_charges: number;
  total_cost: number;
  months: Record<number, number>; // month -> gross
}

interface EmployeeBreakdown {
  employee_id: number;
  name: string;
  lines: Array<{
    month: number;
    category_code: string;
    category_label: string;
    amount: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const BAR_COLORS = ["#066C6C", "#0AAE8E", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

function fmt(val: number, compact = false): string {
  if (compact) {
    if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + " M";
    if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(0) + " K";
    return val.toFixed(0);
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(val);
}

// ─────────────────────────────────────────────────────────────────────────────
// SPARKLINE (mini bar chart inline)
// ─────────────────────────────────────────────────────────────────────────────

function SparkBar({ data, color = "#066C6C" }: { data: number[]; color?: string }) {
  if (!data.some(Boolean)) return <span className="text-gray-300 text-xs">—</span>;
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-px h-6">
      {data.map((v, i) => (
        <div
          key={i}
          className="rounded-sm w-2 transition-all"
          style={{
            height: max > 0 ? `${Math.max((v / max) * 100, 4)}%` : "4%",
            backgroundColor: color,
            opacity: v > 0 ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN MODAL
// ─────────────────────────────────────────────────────────────────────────────

function BreakdownModal({
  employeeId,
  year,
  onClose,
}: {
  employeeId: number;
  year: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<EmployeeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth(`${API_URL}/api/budget-rh/employees/${employeeId}/breakdown?year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [employeeId, year]);

  // Group by category
  const byCat = useMemo(() => {
    if (!data) return [];
    const map: Record<string, { label: string; months: Record<number, number>; total: number }> = {};
    data.lines.forEach(({ category_code, category_label, month, amount }) => {
      if (!map[category_code]) map[category_code] = { label: category_label, months: {}, total: 0 };
      map[category_code].months[month] = amount;
      map[category_code].total += amount;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900 text-lg">
            Détail — {data?.name ?? "Chargement..."}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-auto flex-1 p-4">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-semibold text-gray-500">Rubrique</th>
                  {MONTHS_SHORT.map((m) => (
                    <th key={m} className="text-right p-2 font-semibold text-gray-500">{m}</th>
                  ))}
                  <th className="text-right p-2 font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {byCat.map(([code, { label, months, total }], i) => (
                  <tr key={code} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <td className="p-2 font-medium text-gray-700">{label}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <td key={m} className="text-right p-2 tabular-nums text-gray-600">
                        {months[m] ? fmt(months[m], true) : <span className="text-gray-200">—</span>}
                      </td>
                    ))}
                    <td className="text-right p-2 font-bold text-gray-800">{fmt(total, true)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-primary-50">
                <tr>
                  <td className="p-2 font-bold text-primary-800">TOTAL</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const total = byCat.reduce((s, [, v]) => s + (v.months[m] || 0), 0);
                    return (
                      <td key={m} className="text-right p-2 font-bold text-primary-800 tabular-nums">
                        {total > 0 ? fmt(total, true) : "—"}
                      </td>
                    );
                  })}
                  <td className="text-right p-2 font-bold text-primary-900">
                    {fmt(byCat.reduce((s, [, v]) => s + v.total, 0), true)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetRHEmployeesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useSearchParams();

  const { year, setYear, currentYear } = useBudgetYear();
  const [month, setMonth] = useState<number | null>(null); // null = all months
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<"name" | "cost" | "gross">("cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", String(month));
    if (departmentFilter) params.set("department_name", departmentFilter);

    try {
      const res = await fetchWithAuth(`${API_URL}/api/budget-rh/employees?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
        const depts = [...new Set(data.map((e: Employee) => e.department_name).filter(Boolean))] as string[];
        setDepartments(depts.sort());
      }
    } finally {
      setLoading(false);
    }
  }, [year, month, departmentFilter]);

  useEffect(() => { load(); }, [load]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = [...employees];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.first_name?.toLowerCase().includes(q) ||
          e.last_name?.toLowerCase().includes(q) ||
          e.job_title?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortField === "name") { av = `${a.last_name} ${a.first_name}`; bv = `${b.last_name} ${b.first_name}`; }
      else if (sortField === "cost") { av = a.total_cost; bv = b.total_cost; }
      else { av = a.total_gross; bv = b.total_gross; }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
    });
    return result;
  }, [employees, search, sortField, sortDir]);

  const totalGross = filtered.reduce((s, e) => s + e.total_gross, 0);
  const totalCost = filtered.reduce((s, e) => s + e.total_cost, 0);

  // Top 8 by cost for bar chart
  const topChart = [...filtered]
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 8)
    .map((e) => ({ name: `${e.first_name} ${e.last_name}`.trim(), cost: e.total_cost, gross: e.total_gross }));

  // ───────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/budget-rh")}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" />
            Détail par employé
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Coût salarial individuel — sources : bulletins de paie validés</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Year */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              className="text-sm font-medium text-gray-700 bg-transparent outline-none"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {/* Month */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={month ?? ""}
              onChange={(e) => setMonth(e.target.value ? +e.target.value : null)}
              className="text-sm text-gray-700 bg-transparent outline-none"
            >
              <option value="">Tous les mois</option>
              {MONTHS_SHORT.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          {/* Department */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none"
            >
              <option value="">Tous départements</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {/* Search */}
          <div className="flex-1 min-w-[200px] flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un employé..."
              className="text-sm text-gray-700 bg-transparent outline-none w-full"
            />
          </div>
          <button
            onClick={() => window.open(`${API_URL}/api/budget-rh/export?year=${year}&type=employees`, "_blank")}
            className="flex items-center gap-2 text-sm border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Top employees chart */}
      {!loading && topChart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top coûts totaux ({topChart.length} premiers)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topChart} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, true)} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="cost" name="Coût total" radius={[0, 4, 4, 0]}>
                {topChart.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Employés", value: filtered.length.toString(), icon: Users, color: "text-primary-600 bg-primary-50" },
          { label: "Salaire brut total", value: fmt(totalGross, true), icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
          { label: "Coût total chargé", value: fmt(totalCost, true), icon: Briefcase, color: "text-purple-600 bg-purple-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${color.split(" ")[1]} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color.split(" ")[0]}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Employee table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  className="text-left py-3 px-4 font-semibold text-gray-500 uppercase text-xs tracking-wide cursor-pointer hover:text-primary-600"
                  onClick={() => { setSortField("name"); setSortDir(sortField === "name" && sortDir === "asc" ? "desc" : "asc"); }}
                >
                  Employé {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 uppercase text-xs tracking-wide">Département</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 uppercase text-xs tracking-wide">Poste</th>
                <th
                  className="text-right py-3 px-4 font-semibold text-gray-500 uppercase text-xs tracking-wide cursor-pointer hover:text-primary-600"
                  onClick={() => { setSortField("gross"); setSortDir(sortField === "gross" && sortDir === "asc" ? "desc" : "asc"); }}
                >
                  Brut {sortField === "gross" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="text-right py-3 px-4 font-semibold text-gray-500 uppercase text-xs tracking-wide cursor-pointer hover:text-primary-600"
                  onClick={() => { setSortField("cost"); setSortDir(sortField === "cost" && sortDir === "asc" ? "desc" : "asc"); }}
                >
                  Coût total {sortField === "cost" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-500 uppercase text-xs tracking-wide">Évolution</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Aucun employé trouvé pour cette sélection</p>
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const sparkData = Array.from({ length: 12 }, (_, i) => emp.months[i + 1] ?? 0);
                  const initials = `${emp.first_name?.[0] ?? ""}${emp.last_name?.[0] ?? ""}`.toUpperCase();
                  return (
                    <tr key={emp.employee_id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {initials || "?"}
                          </div>
                          <span className="font-medium text-gray-800">
                            {[emp.first_name, emp.last_name].filter(Boolean).join(" ") || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{emp.department_name || "—"}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs">{emp.job_title || "—"}</td>
                      <td className="py-3 px-4 text-right font-medium text-gray-700 tabular-nums">
                        {emp.total_gross > 0 ? fmt(emp.total_gross, true) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900 tabular-nums">
                        {emp.total_cost > 0 ? fmt(emp.total_cost, true) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <SparkBar data={sparkData} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedEmpId(emp.employee_id)}
                          className="text-primary-600 hover:text-primary-800 transition-colors p-1"
                          title="Voir le détail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal breakdown */}
      {selectedEmpId !== null && (
        <BreakdownModal
          employeeId={selectedEmpId}
          year={year}
          onClose={() => setSelectedEmpId(null)}
        />
      )}
    </div>
  );
}
