import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { attachmentExtension, attachmentTypes, TOTAL_FILE_LIMIT, validateAttachmentList, type TemporaryAttachment } from '../src/lib/attachments.ts';
import { AssistantError } from './openai.ts';

const EXPIRES_SECONDS = 3600;
interface UploadedFile { id: string; user: string; name: string; type: string; size: number; expiresAt: number }
const tokenKey = (key: string) => createHash('sha256').update(`workhub-temporary-attachments\0${key}`).digest();
export function attachmentsModel(model: string) {
  // Verified against the current official model and file-input documentation.
  if (!/^gpt-5-mini(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) throw new AssistantError('Attachments are not enabled for the configured model.', 400);
}
function seal(file: UploadedFile, key: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', tokenKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(file)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function open(token: string, key: string, user: string): UploadedFile {
  try {
    if (!/^[A-Za-z0-9_-]{40,2400}$/.test(token)) throw new Error();
    const buffer = Buffer.from(token, 'base64url'); const decipher = createDecipheriv('aes-256-gcm', tokenKey(key), buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    const file = JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString()) as UploadedFile;
    if (file.user !== user || !/^file-[A-Za-z0-9_-]+$/.test(file.id)) throw new Error();
    if (!Number.isSafeInteger(file.expiresAt) || file.expiresAt <= Date.now() || file.expiresAt > Date.now() + EXPIRES_SECONDS * 1000 + 10000) throw new Error();
    validateAttachmentList([file]); return file;
  } catch { throw new AssistantError('These temporary attachments are unavailable. Attach the files again.', 410); }
}
export function attachmentParts(tokens: string[], key: string, user: string, model: string) {
  attachmentsModel(model);
  const files = tokens.map(token => open(token, key, user));
  validateAttachmentList(files);
  return files.map(file => file.type.startsWith('image/') ? { type: 'input_image', file_id: file.id, detail: 'auto' } : { type: 'input_file', file_id: file.id });
}

// Inspect OOXML central-directory metadata and only inflate the tiny type manifest.
// Never extract archives to disk or expand arbitrary embedded content.
function officeType(data: Buffer, extension: string): boolean {
  let end = -1;
  for (let offset = data.length - 22; offset >= Math.max(0, data.length - 65557); offset--) if (data.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  if (end < 0 || data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6)) return false;
  const entries = data.readUInt16LE(end + 10); let cursor = data.readUInt32LE(end + 16); let expanded = 0;
  const names = new Set<string>(); let manifest = '';
  if (entries < 1 || entries > 2000) return false;
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > data.length || data.readUInt32LE(cursor) !== 0x02014b50) return false;
    const flags = data.readUInt16LE(cursor + 8), method = data.readUInt16LE(cursor + 10);
    const packed = data.readUInt32LE(cursor + 20), size = data.readUInt32LE(cursor + 24);
    const length = data.readUInt16LE(cursor + 28), extra = data.readUInt16LE(cursor + 30), comment = data.readUInt16LE(cursor + 32);
    if (cursor + 46 + length + extra + comment > data.length || flags & 1 || ![0, 8].includes(method)) return false;
    const name = data.subarray(cursor + 46, cursor + 46 + length).toString('utf8');
    if (names.has(name) || /(^\/|\\|(^|\/)\.\.(\/|$)|vbaProject|activeX)/i.test(name)) return false;
    names.add(name); expanded += size;
    if (expanded > 40 * 1024 * 1024) return false;
    if (name === '[Content_Types].xml') {
      const start = data.readUInt32LE(cursor + 42);
      if (size > 128000 || start + 30 > data.length || data.readUInt32LE(start) !== 0x04034b50) return false;
      const payload = start + 30 + data.readUInt16LE(start + 26) + data.readUInt16LE(start + 28);
      if (payload + packed > data.length) return false;
      const bytes = data.subarray(payload, payload + packed);
      manifest = (method === 0 ? bytes : inflateRawSync(bytes, { maxOutputLength: 128000 })).toString('utf8');
    }
    cursor += 46 + length + extra + comment;
  }
  const main: Record<string, string> = { docx: 'word/document.xml', xlsx: 'xl/workbook.xml', pptx: 'ppt/presentation.xml' };
  const content: Record<string, string> = { docx: 'wordprocessingml.document.main+xml', xlsx: 'spreadsheetml.sheet.main+xml', pptx: 'presentationml.presentation.main+xml' };
  return names.has(main[extension]) && manifest.includes(content[extension]);
}
export function validateFileContent(file: File, data: Buffer) {
  const extension = attachmentExtension(file.name);
  let valid = false;
  try {
    if (extension === 'pdf') valid = data.subarray(0, 5).toString() === '%PDF-' && data.subarray(-1024).includes(Buffer.from('%%EOF'));
    else if (extension === 'png') valid = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.length >= 45 && data.subarray(12, 16).toString() === 'IHDR' && data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0 && data.subarray(-8, -4).toString() === 'IEND';
    else if (['jpg', 'jpeg'].includes(extension)) valid = data.length > 4 && data[0] === 255 && data[1] === 216 && data[2] === 255 && data.at(-2) === 255 && data.at(-1) === 217;
    else if (['docx', 'xlsx', 'pptx'].includes(extension)) valid = officeType(data, extension);
    else {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
      let binary = false;
      for (let index = 0; index < text.length; index++) { const code = text.charCodeAt(index); if (code < 32 && ![9, 10, 13].includes(code)) { binary = true; break; } }
      valid = !binary && !/^\s*(?:<!doctype\s+html|<html|<svg|<script|<\?xml)/i.test(text);
    }
  } catch { valid = false; }
  if (!valid) throw new AssistantError('The file content does not match its supported type, or the document is damaged, encrypted or too complex.', 415);
}
export async function readAttachmentUpload(body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<unknown> } } | null, contentType: string, length: string | null, signal?: AbortSignal): Promise<File[]> {
  const limit = TOTAL_FILE_LIMIT + 128 * 1024;
  if (!body || !/^multipart\/form-data;\s*boundary=/i.test(contentType)) throw new AssistantError('Send attachments as multipart form data.', 415);
  if (length && Number(length) > limit) throw new AssistantError('Attachments must total 20 MB or less.', 413);
  const reader = body.getReader(); const chunks: Buffer[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) throw new AssistantError('Attachment upload timed out. Try again.', 408);
      const item = await reader.read(); if (item.done) break;
      const chunk = Buffer.from(item.value!); size += chunk.length;
      if (size > limit) { await reader.cancel(); throw new AssistantError('Attachments must total 20 MB or less.', 413); }
      chunks.push(chunk);
    }
    if (signal?.aborted) throw new AssistantError('Attachment upload timed out. Try again.', 408);
  } finally { signal?.removeEventListener('abort', abort); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw new AssistantError('The upload could not be read. Try attaching the files again.', 400); }
  const files: File[] = [];
  for (const [name, value] of form) {
    if (name !== 'files' || typeof value === 'string') throw new AssistantError('Only file attachments are accepted here.', 400);
    files.push(value);
  }
  try { validateAttachmentList(files); }
  catch (error) { throw new AssistantError((error as Error).message, files.some(file => file.size > 10 * 1024 * 1024) || files.reduce((n, file) => n + file.size, 0) > TOTAL_FILE_LIMIT ? 413 : 415); }
  // Validate the entire batch before uploading anything upstream.
  for (const file of files) validateFileContent(file, Buffer.from(await file.arrayBuffer()));
  return files;
}
export async function createTemporaryAttachments(files: File[], key: string, model: string, user: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<TemporaryAttachment[]> {
  attachmentsModel(model); const created: string[] = []; const attachments: TemporaryAttachment[] = [];
  try {
    for (const file of files) {
      const type = attachmentTypes[attachmentExtension(file.name)];
      const form = new FormData(); form.append('file', new File([file], file.name, { type }), file.name);
      form.append('purpose', file.type.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(attachmentExtension(file.name)) ? 'vision' : 'user_data');
      form.append('expires_after[anchor]', 'created_at'); form.append('expires_after[seconds]', String(EXPIRES_SECONDS));
      const response = await fetcher('https://api.openai.com/v1/files', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal, redirect: 'error' });
      if (!response.ok) throw new AssistantError('Attachment upload was rejected. Check the connection and try again.', response.status === 429 ? 429 : 502);
      const result = await response.json();
      if (typeof result.id !== 'string' || !/^file-[A-Za-z0-9_-]+$/.test(result.id)) throw new AssistantError('The upload was not confirmed. Try again.');
      created.push(result.id);
      const now = Date.now();
      if (result.bytes !== file.size || !Number.isInteger(result.expires_at) || result.expires_at * 1000 <= now || result.expires_at * 1000 > now + EXPIRES_SECONDS * 1000 + 10000) throw new AssistantError('Temporary file expiry was not confirmed. The upload was cancelled.');
      const info = { name: file.name, size: file.size, type, expiresAt: Math.min(result.expires_at * 1000, now + EXPIRES_SECONDS * 1000) };
      attachments.push({ ...info, token: seal({ ...info, id: result.id, user }, key) });
    }
    return attachments;
  } catch (error) {
    // Best-effort early cleanup; expiry is mandatory even when a request is lost.
    await Promise.allSettled(created.map(id => fetcher(`https://api.openai.com/v1/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000), redirect: 'error' })));
    throw error instanceof AssistantError ? error : new AssistantError('Attachment upload timed out or failed. Your message is unchanged; try again.');
  }
}
