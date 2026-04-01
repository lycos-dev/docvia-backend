const BASE = '/api/pdf';

export interface PDFFile {
  filename: string;   // storage name — used as pdfId (e.g. "1234_abc_myfile.pdf")
  name: string;       // display name
  uploadedAt: string;
  sizeLabel: string;
}

export interface UploadResult {
  success: boolean;
  data?: {
    filename: string;
    originalFilename: string;
    publicUrl: string;
  };
  error?: string;
}

export interface BackendLesson {
  id: number;
  title: string;
  explanation: string;
  key_points: string[];
}

export interface LessonSet {
  id: string;
  pdfId: string;
  title: string;
  overview: string;
  lessons: BackendLesson[];
  totalLessons: number;
}

export interface LessonSetResult {
  success: boolean;
  data?: LessonSet;
  error?: string;
  message?: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// The backend stores files as "timestamp_randomhex_originalname.pdf".
// Strip the prefix to get a readable display name.
function toDisplayName(filename: string): string {
  return filename
    .replace(/^\d+_[a-z0-9]+_/i, '')
    .replace(/_/g, ' ')
    .replace(/\.pdf$/i, '');
}

export async function uploadPDF(file: File, token: string): Promise<UploadResult> {
  const form = new FormData();
  form.append('pdf', file);
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
}

export async function listPDFs(): Promise<PDFFile[]> {
  const res = await fetch(`${BASE}/list`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return json.data.map((raw: any): PDFFile => ({
    filename: raw.name,
    name: toDisplayName(raw.name),
    uploadedAt: raw.created_at ?? '',
    sizeLabel: raw.metadata?.size ? formatSize(raw.metadata.size) : '',
  }));
}

export async function deletePDF(
  filename: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function generateLessons(
  pdfId: string,
  userId: string
): Promise<LessonSetResult> {
  const res = await fetch(`${BASE}/lessons/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId, userId }),
  });
  return res.json();
}

export async function getLessons(pdfId: string): Promise<LessonSetResult> {
  const res = await fetch(`${BASE}/lessons/${encodeURIComponent(pdfId)}`);
  return res.json();
}
