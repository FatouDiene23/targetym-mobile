import jsPDF from 'jspdf';
import { Employee } from '@/lib/api';

// Fonction pour formater les dates
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

// Fonction pour formater le salaire
const formatSalary = (salary?: number, currency?: string): string => {
  if (!salary) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'XOF',
    minimumFractionDigits: 0
  }).format(salary);
};

// Fonction pour formater le type de contrat
const formatContractType = (type?: string): string => {
  if (!type) return '-';
  const types: Record<string, string> = {
    'cdi': 'CDI - Contrat à Durée Indéterminée',
    'cdd': 'CDD - Contrat à Durée Déterminée',
    'stage': 'Stage',
    'alternance': 'Alternance',
    'consultant': 'Consultant',
    'interim': 'Intérim'
  };
  return types[type.toLowerCase()] || type.toUpperCase();
};

// Fonction pour formater le genre
const formatGender = (gender?: string): string => {
  if (!gender) return '-';
  const g = gender.toLowerCase();
  if (g === 'female' || g === 'f') return 'Féminin';
  if (g === 'male' || g === 'm') return 'Masculin';
  return 'Autre';
};

// Fonction pour formater le statut
const formatStatus = (status?: string): string => {
  if (!status) return 'Actif';
  const statuses: Record<string, string> = {
    'active': 'Actif',
    'on_leave': 'En congés',
    'suspended': 'Suspendu',
    'terminated': 'Contrat terminé',
    'probation': 'Période d\'essai'
  };
  return statuses[status.toLowerCase()] || status;
};

// Calculer l'ancienneté
const calculateSeniority = (hireDate?: string): string => {
  if (!hireDate) return '-';
  const hire = new Date(hireDate);
  const today = new Date();
  const years = today.getFullYear() - hire.getFullYear();
  const months = today.getMonth() - hire.getMonth();
  
  let totalMonths = years * 12 + months;
  if (today.getDate() < hire.getDate()) {
    totalMonths--;
  }
  
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  
  if (y > 0 && m > 0) return `${y} an${y > 1 ? 's' : ''} et ${m} mois`;
  if (y > 0) return `${y} an${y > 1 ? 's' : ''}`;
  if (m > 0) return `${m} mois`;
  return 'Moins d\'un mois';
};

// Calculer l'âge
const calculateAge = (birthDate?: string): string => {
  if (!birthDate) return '-';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} ans`;
};

export function generateEmployeePDF(employee: Employee, companyName?: string): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Couleurs
  const primaryColor: [number, number, number] = [59, 130, 246]; // Bleu
  const grayColor: [number, number, number] = [107, 114, 128];
  const darkColor: [number, number, number] = [17, 24, 39];

  // === EN-TÊTE ===
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Titre
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('DOSSIER EMPLOYÉ', margin, 25);

  // Nom de l'entreprise
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(companyName || 'TARGETYM', pageWidth - margin, 15, { align: 'right' });
  
  // Date de génération
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, pageWidth - margin, 25, { align: 'right' });

  y = 60;

  // === NOM ET POSTE ===
  doc.setTextColor(...darkColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${employee.first_name} ${employee.last_name}`, margin, y);
  
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'normal');
  doc.text(employee.job_title || employee.position || '-', margin, y);

  // Statut
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text(`Statut: ${formatStatus(employee.status)}`, margin, y);

  // Matricule
  if (employee.employee_id) {
    doc.text(`Matricule: ${employee.employee_id}`, margin + 80, y);
  }

  y += 15;

  // === SECTION: INFORMATIONS PERSONNELLES ===
  const drawSection = (title: string, startY: number): number => {
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, startY, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, startY + 6);
    return startY + 12;
  };

  const drawField = (label: string, value: string, startY: number, xOffset: number = 0): number => {
    doc.setTextColor(...grayColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, margin + xOffset, startY);
    
    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '-', margin + xOffset, startY + 5);
    
    return startY + 12;
  };

  // Informations Personnelles
  y = drawSection('INFORMATIONS PERSONNELLES', y);
  
  const col1 = 0;
  const col2 = 60;
  const col3 = 120;
  
  let row1Y = y;
  drawField('Email', employee.email, row1Y, col1);
  drawField('Téléphone', employee.phone || '-', row1Y, col2);
  drawField('Genre', formatGender(employee.gender), row1Y, col3);
  
  row1Y += 15;
  const birthDate = employee.date_of_birth || employee.birth_date;
  drawField('Date de naissance', birthDate ? `${formatDate(birthDate)} (${calculateAge(birthDate)})` : '-', row1Y, col1);
  drawField('Nationalité', employee.nationality || '-', row1Y, col2);
  drawField('Adresse', employee.address || '-', row1Y, col3);

  y = row1Y + 20;

  // === SECTION: INFORMATIONS PROFESSIONNELLES ===
  y = drawSection('INFORMATIONS PROFESSIONNELLES', y);
  
  row1Y = y;
  drawField('Poste', employee.job_title || employee.position || '-', row1Y, col1);
  drawField('Département', employee.department_name || '-', row1Y, col2);
  drawField('Manager', employee.manager_name || '-', row1Y, col3);
  
  row1Y += 15;
  drawField('Site / Localisation', employee.site || employee.location || '-', row1Y, col1);
  drawField('Est manager', employee.is_manager ? 'Oui' : 'Non', row1Y, col2);

  y = row1Y + 20;

  // === SECTION: CONTRAT ===
  y = drawSection('INFORMATIONS CONTRACTUELLES', y);
  
  row1Y = y;
  drawField('Type de contrat', formatContractType(employee.contract_type), row1Y, col1);
  drawField('Date d\'embauche', formatDate(employee.hire_date), row1Y, col2);
  drawField('Ancienneté', calculateSeniority(employee.hire_date), row1Y, col3);
  
  row1Y += 15;
  drawField('Salaire brut', formatSalary(employee.salary, employee.currency), row1Y, col1);
  drawField('Salaire net', formatSalary(employee.net_salary, employee.currency), row1Y, col2);

  row1Y += 15;
  drawField('Devise', employee.currency || 'XOF', row1Y, col1);

  y = row1Y + 25;

  // === PIED DE PAGE ===
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.text('Document confidentiel - Usage interne uniquement', margin, footerY);
  doc.text(`Page 1/1`, pageWidth - margin, footerY, { align: 'right' });

  // Télécharger le PDF
  const fileName = `dossier_${employee.first_name}_${employee.last_name}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export default generateEmployeePDF;
