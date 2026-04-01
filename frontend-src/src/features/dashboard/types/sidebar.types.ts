export type UploadedFile = {
  id: string;
  filename: string;
  name: string;
  uploadedAt: string;
  sizeLabel?: string;
  type?: 'pdf' | 'docx' | 'txt' | 'other';
};
