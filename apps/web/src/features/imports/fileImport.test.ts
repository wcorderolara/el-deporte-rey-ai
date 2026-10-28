/**
 * Preparation of a file import (T11H-F01, T11H-F20, NV-11): NFC file name, channel by extension, size checked
 * before reading, exact bytes sent as base64.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { channelOfFileName, checkDeclaredSource, MAX_IMPORT_BYTES, prepareFileImport } from './fileImport';
import { bytesFile, decodeBase64, referenceBase64 } from './testSupport';

afterEach(() => {
  vi.restoreAllMocks();
});

const CONTENT = [...new TextEncoder().encode('{"format":"edr-manual-import/1"}')];

describe('channelOfFileName', () => {
  it('maps .json and .csv and refuses other names', () => {
    expect(channelOfFileName('a.json')).toBe('json_file');
    expect(channelOfFileName('a.csv')).toBe('csv_file');
    expect(channelOfFileName('a.JSON')).toBeNull();
    expect(channelOfFileName('a.xlsx')).toBeNull();
  });
});

describe('checkDeclaredSource', () => {
  it('trims, maps empty to null and refuses control or format characters and long text', () => {
    expect(checkDeclaredSource('  ')).toEqual({ ok: true, value: null });
    expect(checkDeclaredSource(' Acta ')).toEqual({ ok: true, value: 'Acta' });
    expect(checkDeclaredSource('a‮b').ok).toBe(false);
    expect(checkDeclaredSource('x'.repeat(81)).ok).toBe(false);
  });
});

describe('prepareFileImport', () => {
  it('builds an ImportFileCreate body with the exact bytes as base64', async () => {
    const check = await prepareFileImport(bytesFile('datos.json', CONTENT), ' Acta sintética ');
    expect(check).toEqual({
      ok: true,
      body: {
        channel: 'json_file',
        fileName: 'datos.json',
        declaredSource: 'Acta sintética',
        contentBase64: referenceBase64(CONTENT),
      },
    });
  });

  it('sends a BOM, CRLF line ends and invalid UTF-8 bytes unchanged and never decodes the file (NV-11)', async () => {
    const text = vi.spyOn(Blob.prototype, 'text');
    const bytes = [0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a,b\r\n'), 0xc3, 0x28, 0xff, 0x0d, 0x0a];
    const check = await prepareFileImport(bytesFile('datos.csv', bytes), '');
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.body.channel).toBe('csv_file');
      expect(decodeBase64(check.body.contentBase64)).toEqual(bytes);
    }
    expect(text).not.toHaveBeenCalled();
  });

  it('normalizes an NFD file name to NFC (T11H-F20)', async () => {
    const nfd = 'Jornada Sintética.csv';
    const check = await prepareFileImport(bytesFile(nfd, CONTENT), '');
    expect(check.ok && check.body.fileName).toBe('Jornada Sintética.csv');
    expect(check.ok && check.body.fileName).not.toBe(nfd);
  });

  it('refuses an oversize file without reading it', async () => {
    const read = vi.spyOn(Blob.prototype, 'arrayBuffer');
    const check = await prepareFileImport(bytesFile('grande.csv', new Uint8Array(MAX_IMPORT_BYTES + 1)), '');
    expect(check).toEqual({
      ok: false,
      errors: { file: 'El archivo supera el tamaño máximo de 512 KiB (524 288 bytes). No se envió.' },
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly 512 KiB', async () => {
    const check = await prepareFileImport(bytesFile('limite.csv', new Uint8Array(MAX_IMPORT_BYTES)), '');
    expect(check.ok && check.body.contentBase64.length).toBe(699052);
  });

  it('refuses a missing, empty, wrongly named or wrongly typed file, and an invalid declared source', async () => {
    expect(await prepareFileImport(null, 'a\u0007')).toEqual({
      ok: false,
      errors: {
        file: 'Seleccione un archivo .json o .csv.',
        declaredSource: 'La fuente declarada contiene caracteres no permitidos (caracteres de control o de formato).',
      },
    });
    const empty = await prepareFileImport(bytesFile('vacio.csv', []), '');
    expect(empty.ok === false && empty.errors.file).toBe('El archivo está vacío.');
    const extension = await prepareFileImport(bytesFile('datos.xlsx', CONTENT), '');
    expect(extension.ok === false && extension.errors.file).toMatch(/\.json o \.csv/);
    const name = await prepareFileImport(bytesFile('datos#3.csv', CONTENT), '');
    expect(name.ok === false && name.errors.file).toMatch(/nombre del archivo no es válido/);
  });
});
