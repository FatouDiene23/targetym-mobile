'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload, Download, CheckCircle, XCircle, AlertCircle,
  FileSpreadsheet, Loader2, RefreshCw, Info, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { importEmployeesFromFile, downloadEmployeeImportTemplate, type ImportEmployeesResult } from '@/lib/api';

// ============================================
// Colonnes du template (pour le guide)
// ============================================
const TEMPLATE_COLUMNS = [
  { col: 'prenom', required: true, desc: 'Prénom du collaborateur' },
  { col: 'nom', required: true, desc: 'Nom de famille' },
  { col: 'email', required: true, desc: 'Email professionnel (pas Gmail, Yahoo…)' },
  { col: 'matricule', required: false, desc: 'Identifiant interne (ex: EMP-001)' },
  { col: 'telephone', required: false, desc: 'Numéro de téléphone' },
  { col: 'poste', required: false, desc: 'Intitulé du poste' },
  { col: 'departement', required: false, desc: 'Nom exact du département (doit exister)' },
  { col: 'type_contrat', required: false, desc: 'CDI · CDD · Freelance · Stage · Alternance' },
  { col: 'date_embauche', required: false, desc: 'Format AAAA-MM-JJ ou JJ/MM/AAAA' },
  { col: 'genre', required: false, desc: 'male / female (ou M / F)' },
  { col: 'role', required: false, desc: 'employee · manager · rh · admin · dg' },
  { col: 'est_manager', required: false, desc: 'oui / non' },
  { col: 'site', required: false, desc: 'Localisation (ex: Abidjan)' },
  { col: 'salaire_brut', required: false, desc: 'Nombre (ex: 500000)' },
  { col: 'salaire_net', required: false, desc: 'Nombre (ex: 400000)' },
  { col: 'devise', required: false, desc: 'XOF · EUR · USD (défaut: XOF)' },
  { col: 'statut', required: false, desc: 'active · probation · on_leave · terminated' },
];

export default function ImportEmployeesTab({ onImportDone }: { onImportDone?: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportEmployeesResult | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx'].includes(ext)) {
      toast.error('Seuls les fichiers CSV et XLSX sont acceptés.');
      return;
    }
    setSelectedFile(file);
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const res = await importEmployeesFromFile(selectedFile);
      setResult(res);
      if (res.created > 0) {
        toast.success(`${res.created} collaborateur(s) importé(s) avec succès !`);
        onImportDone?.();
      } else {
        toast.error('Aucun collaborateur importé.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">

      {/* Header + template download */}
      <div className="bg-white rounded-xl p-3 lg:p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import de collaborateurs</h2>
            <p className="text-sm text-gray-500 mt-1">
              Importez plusieurs collaborateurs en une seule fois depuis un fichier CSV ou Excel.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowGuide(g => !g)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Info className="w-4 h-4" />
              Guide des colonnes
            </button>
            <button
              onClick={downloadEmployeeImportTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              Télécharger le template CSV
            </button>
          </div>
        </div>

        {/* Guide des colonnes */}
        {showGuide && (
          <div className="mt-4 border border-blue-100 rounded-lg bg-primary-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-primary-800">Colonnes disponibles</p>
              <button onClick={() => setShowGuide(false)} className="text-blue-400 hover:text-primary-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {TEMPLATE_COLUMNS.map(({ col, required, desc }) => (
                <div key={col} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0 ${required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {col}
                  </span>
                  <span className="text-primary-700">{desc}{required && <span className="text-red-500 ml-1">*</span>}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-primary-600 mt-3">* Champs obligatoires</p>
          </div>
        )}
      </div>

      {/* Zone de dépôt */}
      {!result && (
        <div className="bg-white rounded-xl p-3 lg:p-6 shadow-sm border border-gray-100">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
              ${dragOver ? 'border-orange-400 bg-orange-50' : selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-orange-300 hover:bg-orange-50/30'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-800">{selectedFile.name}</p>
                  <p className="text-sm text-green-600">{(selectedFile.size / 1024).toFixed(1)} Ko</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  className="text-xs text-gray-500 underline hover:text-gray-700"
                >
                  Changer de fichier
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">Glissez votre fichier ici</p>
                  <p className="text-sm text-gray-500 mt-1">ou cliquez pour sélectionner un fichier CSV ou XLSX</p>
                </div>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isImporting ? 'Import en cours…' : 'Lancer l\'import'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Résultats */}
      {result && (
        <div className="bg-white rounded-xl p-3 lg:p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Résultats de l'import</h3>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
              Nouvel import
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600">Créé(s)</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-center">
              <AlertCircle className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
              <p className="text-xs text-yellow-600">Ignoré(s)</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
              <FileSpreadsheet className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-700">{result.total}</p>
              <p className="text-xs text-gray-500">Total lignes</p>
            </div>
          </div>

          {/* Erreurs */}
          {result.errors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500" />
                Lignes non importées ({result.errors.length})
              </p>
              <div className="border border-red-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-red-700 font-medium w-16">Ligne</th>
                      <th className="px-3 py-2 text-left text-red-700 font-medium w-48">Email</th>
                      <th className="px-3 py-2 text-left text-red-700 font-medium">Raison</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {result.errors.map((err, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                        <td className="px-3 py-2 text-gray-500 font-mono">{err.row}</td>
                        <td className="px-3 py-2 text-gray-700">{err.email}</td>
                        <td className="px-3 py-2 text-red-600">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.created > 0 && result.errors.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Tous les collaborateurs ont été importés avec succès.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
