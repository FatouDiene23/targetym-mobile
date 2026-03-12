'use client';

import toast from 'react-hot-toast';
import { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, Download, Building2, User, Calendar, Briefcase } from 'lucide-react';
import { Employee } from '@/lib/api';
import jsPDF from 'jspdf';

interface CertificateModalProps {
  employee: Employee;
  onClose: () => void;
  companyInfo?: {
    name: string;
    address: string;
    logo?: string;
    signatoryName?: string;
    signatoryTitle?: string;
    signature?: string;
  };
}

const departureReasons = [
  { value: 'resignation', label: 'Démission' },
  { value: 'end_contract', label: 'Fin de contrat (CDD)' },
  { value: 'mutual_agreement', label: 'Rupture conventionnelle' },
  { value: 'dismissal', label: 'Licenciement' },
  { value: 'retirement', label: 'Départ à la retraite' },
  { value: 'other', label: 'Autre' },
];

export default function CertificateModal({ employee, onClose, companyInfo }: CertificateModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formulaire pré-rempli
  const [formData, setFormData] = useState({
    // Infos employé (pré-remplies)
    employeeName: `${employee.first_name} ${employee.last_name}`,
    birthDate: employee.date_of_birth || employee.birth_date || '',
    jobTitle: employee.job_title || employee.position || '',
    department: employee.department_name || '',
    startDate: employee.hire_date || '',
    endDate: '',
    
    // Infos départ
    departureReason: 'resignation',
    customReason: '',
    
    // Infos entreprise
    companyName: companyInfo?.name || 'TARGETYM',
    companyAddress: companyInfo?.address || '',
    
    // Signataire
    signatoryName: companyInfo?.signatoryName || '',
    signatoryTitle: companyInfo?.signatoryTitle || 'Directeur des Ressources Humaines',
    signature: companyInfo?.signature || '',
    
    // Date du certificat
    certificateDate: new Date().toISOString().split('T')[0],
    certificatePlace: '',
    
    // Mention
    freeEngagement: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          signature: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDepartureReasonText = (): string => {
    if (formData.departureReason === 'other') return formData.customReason;
    return departureReasons.find(r => r.value === formData.departureReason)?.label || '';
  };

  const generatePDF = () => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      let y = 30;

      // Couleurs
      const darkColor: [number, number, number] = [17, 24, 39];
      const grayColor: [number, number, number] = [107, 114, 128];

      // === EN-TÊTE ENTREPRISE ===
      doc.setTextColor(...darkColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(formData.companyName.toUpperCase(), margin, y);
      
      if (formData.companyAddress) {
        y += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text(formData.companyAddress, margin, y);
      }

      // === TITRE ===
      y = 70;
      doc.setTextColor(...darkColor);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('CERTIFICAT DE TRAVAIL', pageWidth / 2, y, { align: 'center' });

      // Ligne décorative
      y += 5;
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);

      // === CORPS DU CERTIFICAT ===
      y = 95;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);

      const lineHeight = 8;
      const textWidth = pageWidth - 2 * margin;

      // Paragraphe 1 - Introduction
      let text = `Je soussigné(e), ${formData.signatoryName || '[Nom du signataire]'}, ${formData.signatoryTitle}, de la société ${formData.companyName}, certifie que :`;
      const lines1 = doc.splitTextToSize(text, textWidth);
      doc.text(lines1, margin, y);
      y += lines1.length * lineHeight + 5;

      // Paragraphe 2 - Employé
      doc.setFont('helvetica', 'bold');
      text = `${formData.employeeName}`;
      doc.text(text, margin, y);
      y += lineHeight;

      doc.setFont('helvetica', 'normal');
      if (formData.birthDate) {
        text = `Né(e) le ${formatDate(formData.birthDate)}`;
        doc.text(text, margin, y);
        y += lineHeight + 3;
      }

      // Paragraphe 3 - Emploi
      text = `A été employé(e) au sein de notre entreprise du ${formatDate(formData.startDate)} au ${formatDate(formData.endDate)}, en qualité de :`;
      const lines3 = doc.splitTextToSize(text, textWidth);
      doc.text(lines3, margin, y);
      y += lines3.length * lineHeight + 3;

      doc.setFont('helvetica', 'bold');
      doc.text(`${formData.jobTitle}`, margin + 10, y);
      y += lineHeight;

      if (formData.department) {
        doc.setFont('helvetica', 'normal');
        doc.text(`au sein du département ${formData.department}.`, margin + 10, y);
        y += lineHeight + 5;
      }

      // Paragraphe 4 - Motif
      doc.setFont('helvetica', 'normal');
      text = `${employee.gender?.toLowerCase() === 'female' ? 'Mme' : 'M.'} ${formData.employeeName} a quitté notre entreprise pour le motif suivant : ${getDepartureReasonText()}.`;
      const lines4 = doc.splitTextToSize(text, textWidth);
      doc.text(lines4, margin, y);
      y += lines4.length * lineHeight + 5;

      // Paragraphe 5 - Libre de tout engagement
      if (formData.freeEngagement) {
        text = `${employee.gender?.toLowerCase() === 'female' ? 'Mme' : 'M.'} ${formData.employeeName} nous quitte libre de tout engagement.`;
        const lines5 = doc.splitTextToSize(text, textWidth);
        doc.text(lines5, margin, y);
        y += lines5.length * lineHeight + 5;
      }

      // Paragraphe 6 - Formule finale
      text = `En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.`;
      const lines6 = doc.splitTextToSize(text, textWidth);
      doc.text(lines6, margin, y);
      y += lines6.length * lineHeight + 15;

      // === DATE ET LIEU ===
      const rightX = pageWidth - margin;
      doc.text(`Fait à ${formData.certificatePlace || '[Lieu]'}, le ${formatDate(formData.certificateDate)}`, rightX, y, { align: 'right' });
      y += lineHeight * 2;

      // === SIGNATURE ===
      doc.setFont('helvetica', 'bold');
      doc.text(formData.signatoryName || '[Nom du signataire]', rightX, y, { align: 'right' });
      y += lineHeight;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grayColor);
      doc.text(formData.signatoryTitle, rightX, y, { align: 'right' });
      y += lineHeight + 5;

      // Image signature si uploadée
      if (formData.signature) {
        try {
          doc.addImage(formData.signature, 'PNG', rightX - 50, y, 50, 25);
        } catch (e) {
          console.error('Erreur ajout signature:', e);
        }
      }

      // === PIED DE PAGE ===
      doc.setTextColor(...grayColor);
      doc.setFontSize(8);
      doc.text('Ce document est un certificat de travail établi conformément à l\'article L.1234-19 du Code du travail.', margin, pageHeight - 15);

      // Télécharger
      const fileName = `certificat_travail_${employee.first_name}_${employee.last_name}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      toast.error('Erreur lors de la génération du certificat');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-emerald-600">
          <div className="flex items-center text-white">
            <FileText className="w-6 h-6 mr-3" />
            <div>
              <h2 className="text-lg font-bold">Générer un Certificat de Travail</h2>
              <p className="text-emerald-100 text-sm">{employee.first_name} {employee.last_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Section Employé */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-4 h-4 mr-2 text-emerald-500" />
                Informations Employé
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom complet</label>
                  <input
                    type="text"
                    name="employeeName"
                    value={formData.employeeName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date de naissance</label>
                  <input
                    type="date"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Poste occupé</label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Département</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Section Période */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-emerald-500" />
                Période d&apos;emploi
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date d&apos;entrée</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date de sortie *</label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Motif de départ *</label>
                  <select
                    name="departureReason"
                    value={formData.departureReason}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {departureReasons.map(reason => (
                      <option key={reason.value} value={reason.value}>{reason.label}</option>
                    ))}
                  </select>
                </div>
                {formData.departureReason === 'other' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Précisez le motif</label>
                    <input
                      type="text"
                      name="customReason"
                      value={formData.customReason}
                      onChange={handleChange}
                      placeholder="Motif de départ..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="freeEngagement"
                      checked={formData.freeEngagement}
                      onChange={handleChange}
                      className="w-4 h-4 text-emerald-500 rounded mr-2"
                    />
                    <span className="text-sm text-gray-700">Libre de tout engagement</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section Entreprise */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Building2 className="w-4 h-4 mr-2 text-emerald-500" />
                Informations Entreprise
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom de l&apos;entreprise</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Adresse</label>
                  <input
                    type="text"
                    name="companyAddress"
                    value={formData.companyAddress}
                    onChange={handleChange}
                    placeholder="Adresse de l&apos;entreprise"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Section Signataire */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-emerald-500" />
                Signataire
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom du signataire *</label>
                  <input
                    type="text"
                    name="signatoryName"
                    value={formData.signatoryName}
                    onChange={handleChange}
                    placeholder="Ex: Jean Dupont"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fonction</label>
                  <input
                    type="text"
                    name="signatoryTitle"
                    value={formData.signatoryTitle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Lieu</label>
                  <input
                    type="text"
                    name="certificatePlace"
                    value={formData.certificatePlace}
                    onChange={handleChange}
                    placeholder="Ex: Dakar"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date du certificat</label>
                  <input
                    type="date"
                    name="certificateDate"
                    value={formData.certificateDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Signature (image PNG/JPG)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleSignatureUpload}
                      accept="image/png,image/jpeg"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {formData.signature ? 'Changer la signature' : 'Uploader signature'}
                    </button>
                    {formData.signature && (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={formData.signature} alt="Signature" className="h-10 border rounded" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, signature: '' }))}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
          >
            Annuler
          </button>
          <div className="flex gap-2">
            <button
              onClick={generatePDF}
              disabled={isGenerating || !formData.endDate || !formData.signatoryName}
              className="flex items-center px-4 py-2 text-sm text-white font-medium bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Générer le certificat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
