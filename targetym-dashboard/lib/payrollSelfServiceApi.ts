import { API_URL, fetchWithAuth } from '@/lib/api';

export interface MyPaySlip {
  id: number;
  period_year: number;
  period_month: number;
  net_a_payer: number;
  sent_at: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
}

export interface MyPaySlipList {
  items: MyPaySlip[];
  total: number;
  page: number;
  page_size: number;
}

interface MyPaySlipDownload {
  id: number;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  file_data: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;
  const message = typeof detail === 'string' ? detail : detail?.message;
  throw new Error(message || `Erreur HTTP ${response.status}`);
}

export async function listMyPayslips(
  page: number,
  pageSize: number,
  year?: number,
): Promise<MyPaySlipList> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (year) params.set('year', String(year));
  return parseResponse<MyPaySlipList>(
    await fetchWithAuth(`${API_URL}/api/payroll/my-payslips?${params.toString()}`),
  );
}

export async function downloadMyPayslip(slipId: number): Promise<MyPaySlipDownload> {
  return parseResponse<MyPaySlipDownload>(
    await fetchWithAuth(`${API_URL}/api/payroll/my-payslips/${slipId}/download`),
  );
}

export function saveBase64File(file: MyPaySlipDownload): void {
  const binary = window.atob(file.file_data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: file.mime_type || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.file_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
