"use client";

import { Lock, ChevronRight } from "lucide-react";

const FEATURES = [
  "Budget mensuel par catégorie NRG",
  "Suivi réalisé vs budget en temps réel",
  "Vue par département et par employé",
  "Import / export Excel",
];

export default function BudgetRHPage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
        <div className="bg-indigo-600 text-white text-center px-6 py-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Budget RH</h1>
          <p className="text-indigo-100 text-sm sm:text-base">
            Planification et suivi budgétaire des ressources humaines
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mb-5">
            <Lock className="w-4 h-4" />
            Non activé
          </span>

          <p className="text-gray-700 mb-5 leading-relaxed">
            Planifiez votre masse salariale, suivez les réalisés vs budgets et analysez
            l&apos;évolution des coûts RH par département.
          </p>

          <ul className="space-y-3 mb-6">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-gray-700">
                <ChevronRight className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-800 text-sm mb-5">
            Ce module est disponible en add-on. Contactez votre administrateur Targetym
            pour l&apos;activer.
          </div>

          <p className="text-center text-sm text-gray-500">
            Questions ? Écrivez-nous à{" "}
            <a
              href="mailto:support@targetym.com"
              className="text-indigo-600 hover:underline"
            >
              support@targetym.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
