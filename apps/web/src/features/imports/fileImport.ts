/**
 * Preparation of a file import (createImport, `ImportFileCreate`; T11H-F01, T11H-F20, NV-11):
 *
 * 1. the file name is normalized to NFC (a decomposed macOS name is sent composed) and checked against the contract
 *    `FileName`; the extension gives the channel (`.json` or `.csv`);
 * 2. the size is checked before the file is read: 1 to 524 288 bytes (512 KiB), so an oversize file is refused
 *    before any request;
 * 3. the exact bytes are read with `arrayBuffer()` and sent as `contentBase64`; nothing is decoded, so the server
 *    sees a BOM, CRLF line ends or an invalid UTF-8 sequence unchanged and answers `encoding_invalid` itself.
 *
 * These checks only spare a round trip; the server stays authoritative.
 */
import {
  FileNameSchema,
  IMPORT_CONTENT_BASE64_MAX_LENGTH,
  ImportFileCreateSchema,
  LabelSchema,
  type ImportFileChannel,
  type ImportFileCreate,
} from '@edr/contracts';

import { fileCopy } from './copy';
import { base64Length, encodeBase64, readFileBytes } from './encoding';

/** At most 512 KiB of file bytes (contract createImport; `IMPORT_CONTENT_BASE64_MAX_LENGTH` in base64 characters). */
export const MAX_IMPORT_BYTES = 524288;

/** File picker filter. */
export const IMPORT_FILE_ACCEPT = '.json,.csv,application/json,text/csv';

const LABEL_MAX_LENGTH = 80;

/** Channel given by the extension of a file name, or null for any other name. */
export function channelOfFileName(fileName: string): ImportFileChannel | null {
  if (fileName.endsWith('.json')) {
    return 'json_file';
  }
  if (fileName.endsWith('.csv')) {
    return 'csv_file';
  }
  return null;
}

/** The declared source: trimmed, null when empty; an error text when it is not a contract `Label`. */
export function checkDeclaredSource(value: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === '') {
    return { ok: true, value: null };
  }
  if (trimmed.length > LABEL_MAX_LENGTH) {
    return { ok: false, error: fileCopy.sourceTooLong };
  }
  if (!LabelSchema.safeParse(trimmed).success) {
    return { ok: false, error: fileCopy.sourceInvalid };
  }
  return { ok: true, value: trimmed };
}

export interface FileImportErrors {
  file?: string;
  declaredSource?: string;
}

/** Checks that need no read: name, extension and size. Returns the NFC file name and channel when they pass. */
export function checkFile(
  file: File | null,
): { ok: true; fileName: string; channel: ImportFileChannel } | { ok: false; error: string } {
  if (file === null) {
    return { ok: false, error: fileCopy.fileRequired };
  }
  const fileName = file.name.normalize('NFC');
  const channel = channelOfFileName(fileName);
  if (channel === null) {
    return { ok: false, error: fileCopy.fileExtension };
  }
  if (!FileNameSchema.safeParse(fileName).success) {
    return { ok: false, error: fileCopy.fileName };
  }
  if (file.size === 0) {
    return { ok: false, error: fileCopy.fileEmpty };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: fileCopy.fileTooLarge };
  }
  return { ok: true, fileName, channel };
}

export type FileImportCheck = { ok: true; body: ImportFileCreate } | { ok: false; errors: FileImportErrors };

/** Builds the createImport body of a file, or the errors that keep it from being sent. */
export async function prepareFileImport(file: File | null, declaredSource: string): Promise<FileImportCheck> {
  const errors: FileImportErrors = {};
  const fileCheck = checkFile(file);
  const sourceCheck = checkDeclaredSource(declaredSource);
  if (!fileCheck.ok) {
    errors.file = fileCheck.error;
  }
  if (!sourceCheck.ok) {
    errors.declaredSource = sourceCheck.error;
  }
  if (file === null || !fileCheck.ok || !sourceCheck.ok) {
    return { ok: false, errors };
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFileBytes(file);
  } catch {
    return { ok: false, errors: { file: fileCopy.fileUnreadable } };
  }
  // The file may have changed on disk after it was chosen: the bytes read are what is checked and sent.
  if (bytes.length === 0) {
    return { ok: false, errors: { file: fileCopy.fileEmpty } };
  }
  if (bytes.length > MAX_IMPORT_BYTES || base64Length(bytes.length) > IMPORT_CONTENT_BASE64_MAX_LENGTH) {
    return { ok: false, errors: { file: fileCopy.fileTooLarge } };
  }

  const body: ImportFileCreate = {
    channel: fileCheck.channel,
    fileName: fileCheck.fileName,
    declaredSource: sourceCheck.value,
    contentBase64: encodeBase64(bytes),
  };
  if (!ImportFileCreateSchema.safeParse(body).success) {
    return { ok: false, errors: { file: fileCopy.fileName } };
  }
  return { ok: true, body };
}
