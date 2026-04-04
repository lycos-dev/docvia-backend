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
    uploadedAt?: string;
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

// Safely parse JSON — returns a fallback if the body is empty or non-JSON
async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
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
  return safeJson<UploadResult>(res, { success: false, error: 'Server did not return a response.' });
}

export async function listPDFs(token?: string): Promise<PDFFile[]> {
  try {
    const res = await fetch(`${BASE}/list`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await safeJson<{ success: boolean; data?: unknown[] }>(res, { success: false });
    if (!json.success || !Array.isArray(json.data)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return json.data.map((raw: unknown): PDFFile => {
      const row = raw as Record<string, unknown>;
      const meta = row.metadata as { size?: number } | undefined;
      const sizeBytes = meta?.size;
      return {
        filename: String(row.name ?? ''),
        name: toDisplayName(String(row.name ?? '')),
        uploadedAt: String(
          row.updated_at ?? row.created_at ?? row.last_modified ?? ''
        ),
        sizeLabel: typeof sizeBytes === 'number' && sizeBytes > 0 ? formatSize(sizeBytes) : '',
      };
    });
  } catch {
    return [];
  }
}

export async function deletePDF(
  filename: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return safeJson<{ success: boolean }>(res, { success: false });
}

export async function generateLessons(
  pdfId: string,
  userId: string,
  token?: string
): Promise<LessonSetResult> {
  const res = await fetch(`${BASE}/lessons/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ pdfId, userId }),
  });
  return safeJson<LessonSetResult>(res, { success: false, error: 'Server did not return a response.' });
}

export async function getLessons(pdfId: string, userId: string, token?: string): Promise<LessonSetResult> {
  const res = await fetch(`${BASE}/lessons/${encodeURIComponent(pdfId)}?userId=${encodeURIComponent(userId)}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return safeJson<LessonSetResult>(res, { success: false, error: 'Server did not return a response.' });
}
