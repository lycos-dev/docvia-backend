export type UploadedFile = {
  id: string;
  name: string;
  uploadedAt: string; // ISO string or readable
  sizeLabel?: string; // e.g. "2.4 MB"
  type?: "pdf" | "docx" | "txt" | "other";
};
