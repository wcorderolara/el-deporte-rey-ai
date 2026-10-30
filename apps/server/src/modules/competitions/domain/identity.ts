/** Canonical keys only collapse compatibility forms, case and repeated whitespace; similar spellings stay distinct. */
export function identityKey(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** Keep the operator's readable spelling while normalizing Unicode and incidental surrounding/repeated spaces. */
export function displayValue(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}
