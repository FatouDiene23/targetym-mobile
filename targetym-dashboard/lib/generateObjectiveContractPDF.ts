import type { Locale, Translations } from '@/lib/i18n';

type ContractStatus = 'draft' | 'ready_to_sign' | 'signed' | 'in_progress' | 'closed' | 'cancelled';

export interface ObjectiveContractPdfItem {
  id: number;
  objective_id?: number;
  title: string;
  description?: string;
  action_variables?: string;
  key_results?: ObjectiveContractPdfKeyResult[];
  weight: number;
  due_date?: string;
  minimum_target?: string;
  standard_target?: string;
  excellence_target?: string;
  score?: number;
}

export interface ObjectiveContractPdfKeyResult {
  id: number;
  objective_id: number;
  title: string;
  description?: string;
  kpi_name?: string;
  baseline?: number;
  measurement_direction?: 'increase' | 'decrease' | 'maintain';
  target: number;
  minimum_target?: string;
  standard_target?: string;
  excellence_target?: string;
  current: number;
  unit?: string;
  weight: number;
  progress: number;
}

export interface ObjectiveContractPdfAttitude {
  attitude_id: number;
  name_snapshot?: string;
  description_snapshot?: string;
  expected_behavior?: string;
  evaluation_mode?: string;
  weight: number;
  threshold?: number;
  score?: number;
}

export interface ObjectiveContractPdfData {
  id: number;
  employee_name?: string;
  employee_matricule?: string;
  employee_job_title?: string;
  manager_name?: string;
  department_name?: string;
  period: string;
  status: ContractStatus;
  objectives_weight: number;
  attitudes_weight: number;
  final_score?: number;
  mid_review_date?: string;
  employee_signed_at?: string;
  manager_validated_at?: string;
  employee_signature_url?: string | null;
  manager_signature_url?: string | null;
  rh_signature_url?: string | null;
  rh_signer_name?: string | null;
  items?: ObjectiveContractPdfItem[];
  attitudes?: ObjectiveContractPdfAttitude[];
}

type OkrTranslations = Translations['okr'];

const getDateLocale = (locale: Locale): string => {
  if (locale === 'en') return 'en-US';
  if (locale === 'pt') return 'pt-BR';
  return 'fr-FR';
};

const formatDate = (dateStr: string | undefined, locale: Locale): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString(getDateLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

  const clean = (value?: string | number | null): string => {
    if (value === undefined || value === null || value === '') return '-';
    return String(value);
  };

  const imageFormat = (dataUrl?: string | null): 'PNG' | 'JPEG' => (
    dataUrl?.startsWith('data:image/jpeg') || dataUrl?.startsWith('data:image/jpg') ? 'JPEG' : 'PNG'
  );

export async function generateObjectiveContractPDF(
  contract: ObjectiveContractPdfData,
  companyName = 'TARGETYM AI',
  t: OkrTranslations,
  locale: Locale = 'fr',
): Promise<void> {
  // Force the browser build. The default package entry resolves to the Node build
  // during Turbopack SSR and pulls fflate's worker_threads path on Vercel.
  const { default: jsPDF } = await import('jspdf/dist/jspdf.es.min.js');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const addSignatureImage = (dataUrl: string | null | undefined, x: number, ySig: number, w: number, h: number) => {
    if (!dataUrl) return;
    try {
      doc.addImage(dataUrl, imageFormat(dataUrl), x + 4, ySig + 2, w - 8, h - 6, undefined, 'FAST');
    } catch {
      // Ignore invalid signature image and keep the signature cell readable.
    }
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  let y = 8;

  const primary: [number, number, number] = [0, 111, 111];
  const primaryLight: [number, number, number] = [226, 246, 246];
  const objectiveFill: [number, number, number] = [239, 116, 24];
  const tableBlue: [number, number, number] = [31, 78, 121];
  const minTargetFill: [number, number, number] = [255, 252, 224];
  const standardTargetFill: [number, number, number] = [226, 244, 231];
  const excellenceTargetFill: [number, number, number] = [221, 235, 247];
  const headerFill: [number, number, number] = [241, 245, 249];
  const gray: [number, number, number] = [95, 105, 120];
  const dark: [number, number, number] = [17, 24, 39];
  const border: [number, number, number] = [190, 202, 214];

  const setText = (size: number, color: [number, number, number] = dark, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const footer = () => {
    const fy = pageHeight - 6;
    doc.setDrawColor(...border);
    doc.line(margin, fy - 4, pageWidth - margin, fy - 4);
    setText(6.5, gray);
    doc.text(t.contractPdf.generatedAutomaticallyBy, margin, fy);
    doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, fy, { align: 'right' });
  };

  const ensure = (height: number) => {
    if (y + height <= pageHeight - 12) return;
    footer();
    doc.addPage('a4', 'portrait');
    y = 8;
  };

  const textLines = (text: string, width: number, size = 6.6) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(clean(text), width - 2);
  };

  const cell = (
    text: string,
    x: number,
    yCell: number,
    w: number,
    h: number,
    options: { fill?: [number, number, number]; bold?: boolean; size?: number; align?: 'left' | 'center' | 'right'; color?: [number, number, number] } = {},
  ) => {
    if (options.fill) {
      doc.setFillColor(...options.fill);
      doc.rect(x, yCell, w, h, 'F');
    }
    doc.setDrawColor(...border);
    doc.setLineWidth(0.2);
    doc.rect(x, yCell, w, h);
    setText(options.size ?? 6.6, options.color ?? dark, options.bold);
    const lines = textLines(text, w, options.size ?? 6.6).slice(0, Math.max(1, Math.floor((h - 2) / 3.2)));
    const tx = options.align === 'center' ? x + w / 2 : options.align === 'right' ? x + w - 1.5 : x + 1.5;
    doc.text(lines, tx, yCell + 3.5, { align: options.align ?? 'left' });
  };

  // Compact header
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 16, 'F');
  setText(12, [255, 255, 255], true);
  doc.text(t.contractPdf.title.toUpperCase(), margin, 10.5);
  setText(7, [255, 255, 255]);
  doc.text(companyName, pageWidth - margin, 7, { align: 'right' });
  doc.text(`${t.contractPdf.generatedOn} ${formatDate(new Date().toISOString(), locale)}`, pageWidth - margin, 12, { align: 'right' });
  y = 20;

  // Identity grid
  const labelW = 25;
  const valueW = (contentWidth - labelW * 2) / 2;
  const infoRows = [
    [t.contractPdf.employee, clean(contract.employee_name), t.contractPdf.position, clean(contract.employee_job_title)],
    [t.contractPdf.employeeId, clean(contract.employee_matricule), t.contractPdf.unit, clean(contract.department_name)],
    [t.contractPdf.manager, clean(contract.manager_name), t.contractPdf.period, contract.period],
  ];

  infoRows.forEach((row) => {
    let x = margin;
    for (let i = 0; i < row.length; i += 2) {
      cell(row[i], x, y, labelW, 7, { fill: primaryLight, bold: true, size: 6.5, color: primary });
      x += labelW;
      cell(row[i + 1], x, y, valueW, 7, { size: 6.5 });
      x += valueW;
    }
    y += 7;
  });

  y += 4;
  cell(`${t.contractPdf.objectivesPart} (${t.contractPdf.totalWeight} : ${contract.objectives_weight}%)`, margin, y, contentWidth, 8, {
    fill: primary,
    bold: true,
    size: 8,
    color: [255, 255, 255],
  });
  y += 8;

  const cols = [
    { key: 'variable', label: 'Variable', w: 34 },
    { key: 'kpi', label: 'Description & KPI', w: 75 },
    { key: 'weight', label: t.contractPdf.weight, w: 14 },
    { key: 'due', label: t.contractPdf.dueDate, w: 20 },
    { key: 'min', label: t.contractPdf.minimumTarget, w: 17 },
    { key: 'std', label: t.contractPdf.standardTarget, w: 17 },
    { key: 'exc', label: t.contractPdf.excellenceTarget, w: 17 },
  ];

  const drawTableHeader = () => {
    let x = margin;
    cols.forEach((col) => {
      cell(col.label, x, y, col.w, 7, { fill: tableBlue, bold: true, size: 6.2, align: 'center', color: [255, 255, 255] });
      x += col.w;
    });
    y += 7;
  };

  const formatNumber = (value?: number): string => {
    if (value === undefined || value === null) return '-';
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  };

  const formatKrTarget = (kr: ObjectiveContractPdfKeyResult): string => {
    const value = formatNumber(kr.target);
    return `${value}${kr.unit ? ` ${kr.unit}` : ''}`;
  };

  const items = contract.items || [];
  if (!items.length) {
    cell(t.contractPdf.noContractObjective, margin, y, contentWidth, 10, { size: 7, align: 'center' });
    y += 10;
  }

  items.forEach((item, index) => {
    const keyResults: ObjectiveContractPdfKeyResult[] = item.key_results?.length
      ? item.key_results
      : (item.action_variables || '').split('\n').filter(Boolean).map((line, krIndex) => ({
          id: krIndex + 1,
          title: line,
          objective_id: item.objective_id || 0,
          target: 0,
          current: 0,
          weight: 100,
          progress: 0,
        }));
    const rows: ObjectiveContractPdfKeyResult[] = keyResults.length ? keyResults : [{
      id: 1,
      title: item.title,
      objective_id: item.objective_id || 0,
      description: item.action_variables,
      target: 0,
      current: 0,
      weight: 100,
      progress: 0,
    }];
    const objectiveTitle = `OI ${index + 1} | ${item.title}${item.description ? ` : ${item.description}` : ''}`;
    const rowValues = rows.map((kr, krIndex) => {
      const krTarget = formatKrTarget(kr);
      return [
        `V${krIndex + 1} - ${kr.title}`,
        kr.kpi_name ? `KPI : ${kr.kpi_name}` : clean(kr.description || kr.title),
        krIndex === 0 ? `${item.weight}%` : '',
        krIndex === 0 ? formatDate(item.due_date, locale) : '',
        kr.minimum_target || item.minimum_target || (kr.baseline !== undefined ? `${formatNumber(kr.baseline)}${kr.unit ? ` ${kr.unit}` : ''}` : '-'),
        kr.standard_target || item.standard_target || krTarget,
        kr.excellence_target || item.excellence_target || '-',
      ];
    });
    const rowHeights = rowValues.map((values) => (
      Math.min(22, Math.max(10, ...values.map((value, i) => textLines(value, cols[i].w, 5.8).length * 3 + 3)))
    ));
    const blockHeight = 8 + 7 + rowHeights.reduce((sum, rowH) => sum + rowH, 0);
    ensure(blockHeight + 4);

    cell(objectiveTitle, margin, y, contentWidth, 8, {
      fill: objectiveFill,
      bold: true,
      size: 7,
      color: [255, 255, 255],
    });
    y += 8;
    drawTableHeader();

    rowValues.forEach((values, rowIndex) => {
      let x = margin;
      values.forEach((value, colIndex) => {
        const fill = colIndex === 4
          ? minTargetFill
          : colIndex === 5
            ? standardTargetFill
            : colIndex === 6
              ? excellenceTargetFill
              : rowIndex % 2 === 0 ? [241, 245, 249] as [number, number, number] : [255, 255, 255] as [number, number, number];
        cell(value, x, y, cols[colIndex].w, rowHeights[rowIndex], {
          size: colIndex === 2 || colIndex === 3 ? 5.8 : 5.6,
          bold: colIndex === 0 || colIndex === 2,
          align: colIndex === 2 || colIndex === 3 ? 'center' : 'left',
          fill: colIndex === 2 && rowIndex === 0 ? objectiveFill : fill,
          color: colIndex === 2 && rowIndex === 0 ? [255, 255, 255] : dark,
        });
        x += cols[colIndex].w;
      });
      y += rowHeights[rowIndex];
    });
    y += 3;
  });

  y += 4;
  ensure(42);
  cell(`${t.contractPdf.attitudesPart} (${contract.attitudes_weight}%)`, margin, y, contentWidth, 8, {
    fill: primary,
    bold: true,
    size: 8,
    color: [255, 255, 255],
  });
  y += 8;
  const attitudeCols = [
    { label: t.contractPdf.attitude, w: 38 },
    { label: t.contractPdf.expectedBehavior, w: 76 },
    { label: t.contractPdf.evaluationMode, w: 32 },
    { label: t.contractPdf.weight, w: 18 },
    { label: t.contractPdf.threshold, w: 27 },
  ];

  const drawAttitudeHeader = () => {
    let x = margin;
    attitudeCols.forEach((col) => {
      cell(col.label, x, y, col.w, 8, { fill: headerFill, bold: true, size: 6.4, align: 'center' });
      x += col.w;
    });
    y += 8;
  };

  drawAttitudeHeader();

  const attitudes = contract.attitudes || [];
  if (!attitudes.length) {
    cell(t.contractPdf.noContractAttitude, margin, y, contentWidth, 10, { size: 7, align: 'center' });
    y += 10;
  }

  attitudes.forEach((attitude, index) => {
    const values = [
      clean(attitude.name_snapshot),
      attitude.expected_behavior || attitude.description_snapshot || '-',
      attitude.evaluation_mode || t.attitudeEvaluationContinuous,
      `${attitude.weight}%`,
      attitude.threshold !== undefined && attitude.threshold !== null ? `${attitude.threshold}%` : '-',
    ];
    const heights = values.map((value, i) => textLines(value, attitudeCols[i].w, 6.1).length * 3 + 3);
    const rowH = Math.min(24, Math.max(10, ...heights));
    ensure(rowH + 12);
    if (y < 18) drawAttitudeHeader();

    let x = margin;
    values.forEach((value, i) => {
      cell(value, x, y, attitudeCols[i].w, rowH, {
        size: i === 1 ? 5.9 : 6.1,
        bold: i === 0,
        align: i >= 3 ? 'center' : 'left',
        fill: index % 2 === 0 ? [255, 255, 255] : [249, 250, 251],
      });
      x += attitudeCols[i].w;
    });
    y += rowH;
  });

  y += 4;

  cell(t.contractPdf.weighting, margin, y, 42, 8, { fill: primaryLight, bold: true, size: 6.5, color: primary });
  cell(`${t.objectives} ${contract.objectives_weight}%  |  ${t.attitudes} ${contract.attitudes_weight}%`, margin + 42, y, contentWidth - 42, 8, { size: 6.5 });
  y += 13;

  ensure(34);
  const sigGap = 4;
  const sigW = (contentWidth - sigGap * 2) / 3;
  const employeeSigX = margin;
  const managerSigX = margin + sigW + sigGap;
  const rhSigX = margin + (sigW + sigGap) * 2;
  cell(t.contractPdf.employee, employeeSigX, y, sigW, 8, { fill: headerFill, bold: true, size: 6.7, align: 'center' });
  cell(t.contractPdf.manager, managerSigX, y, sigW, 8, { fill: headerFill, bold: true, size: 6.7, align: 'center' });
  cell(t.contractPdf.managerHr, rhSigX, y, sigW, 8, { fill: headerFill, bold: true, size: 6.7, align: 'center' });
  y += 8;
  const sigH = 20;
  cell(t.contractPdf.dateAndSignature, employeeSigX, y, sigW, sigH, { size: 6.5, align: 'center', color: gray });
  cell(t.contractPdf.dateAndSignature, managerSigX, y, sigW, sigH, { size: 6.5, align: 'center', color: gray });
  cell(clean(contract.rh_signer_name) === '-' ? t.contractPdf.managerHr : clean(contract.rh_signer_name), rhSigX, y, sigW, sigH, { size: 6.5, align: 'center', color: gray });
  addSignatureImage(contract.employee_signature_url, employeeSigX, y, sigW, sigH);
  addSignatureImage(contract.manager_signature_url, managerSigX, y, sigW, sigH);
  addSignatureImage(contract.rh_signature_url, rhSigX, y, sigW, sigH);

  footer();

  const safeName = (contract.employee_name || 'collaborateur').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  doc.save(`contrat_objectifs_${safeName}_${contract.period}.pdf`);
}

export default generateObjectiveContractPDF;
