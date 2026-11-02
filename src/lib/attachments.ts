export const FILE_LIMIT = 10 * 1024 * 1024;
export const TOTAL_FILE_LIMIT = 20 * 1024 * 1024;
export const ATTACHMENT_LIMIT = 3;
export const attachmentTypes: Record<string, string> = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg'
};
export const attachmentAccept = Object.keys(attachmentTypes).map(extension => `.${extension}`).join(',');
export interface AttachmentInfo { name: string; type: string; size: number }
export interface TemporaryAttachment extends AttachmentInfo { token: string; expiresAt: number }
export function attachmentExtension(name: string) { return name.split('.').at(-1)?.toLowerCase() ?? ''; }
export function validateAttachmentList(files: AttachmentInfo[]) {
  if (!files.length || files.length > ATTACHMENT_LIMIT) throw new Error('Attach up to 3 files per message.');
  if (files.reduce((total, file) => total + file.size, 0) > TOTAL_FILE_LIMIT) throw new Error('Attachments must total 20 MB or less.');
  for (const file of files) {
    const extension = attachmentExtension(file.name);
    if (!file.name || file.name.length > 180 || (/[\\/]/.test(file.name) || Array.from(file.name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) throw new Error('Use a simple filename without folders or control characters.');
    if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > FILE_LIMIT) throw new Error('Each attachment must be between 1 byte and 10 MB.');
    const expected = attachmentTypes[extension];
    const generic = ['', 'application/octet-stream'];
    if (!expected || (file.type !== expected && !generic.includes(file.type) && !(extension === 'csv' && ['text/plain', 'application/csv', 'application/vnd.ms-excel'].includes(file.type)))) throw new Error('Use PDF, DOCX, XLSX, PPTX, TXT, CSV, PNG or JPEG files with a matching file type.');
  }
}
export function fileSize(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`; }
export async function uploadAttachments(files: File[], signal: AbortSignal): Promise<TemporaryAttachment[]> {
  validateAttachmentList(files);
  const body = new FormData(); files.forEach(file => body.append('files', file));
  let response: Response;
  try { response = await fetch('/api/assistant/attachments', { method: 'POST', body, signal }); }
  catch { throw new Error('Attachment upload failed or timed out. Your message and files are unchanged; try again.'); }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Upload unavailable. Check your connection and try again.');
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Upload failed. Please try again.');
  if (!Array.isArray(result.attachments) || result.attachments.length !== files.length || result.attachments.some((file: TemporaryAttachment) => typeof file.token !== 'string' || typeof file.expiresAt !== 'number')) throw new Error('Upload was not confirmed. Please try again.');
  return result.attachments;
}
