/**
 * Download of the editorial copy (PD-ARCH-01H): one UTF-8 text file with the current version of every deliverable,
 * organized by network and ready to paste. Each section states its review status, so a text that is not approved yet
 * is never mistaken for an approved one. Sources, evidence and links are not included: they stay in the review's
 * "Investigación y fuentes" panel, apart from the publishable copy.
 */
import {
  type EditorialDeliverable,
  type EditorialPackage,
  type EditorialVersion,
  editorialDeliverableText,
} from '@edr/contracts';

import { formatDateTime } from '../../../ui';

import { deliverableTitle, editorialCopy, stateLabel, writerLabel } from './copy';

/**
 * The paste-ready text of one deliverable: the contract's shared formatter, so the review's download and the export's
 * `copy-editorial.txt` say the same (REVIEW-APPROVAL-01).
 */
export function deliverableText(deliverable: EditorialDeliverable, version: EditorialVersion): string {
  return editorialDeliverableText(deliverable, version.fields);
}

/** The text file of the editorial copy, or null when no deliverable has a version yet. */
export function editorialText(pkg: EditorialPackage, downloadedAt: Date): string | null {
  const sections = pkg.deliverables.flatMap((entry) => {
    const version = entry.current;
    if (version === null) {
      return [];
    }
    const status = `${stateLabel[version.state]} · ${editorialCopy.version(version.versionNumber)}`;
    return [
      `=== ${deliverableTitle[entry.deliverable].toUpperCase()} (${status}) ===\n\n${deliverableText(entry.deliverable, version)}`,
    ];
  });
  if (sections.length === 0) {
    return null;
  }
  const context = pkg.context;
  const heading =
    context === null
      ? 'COPY EDITORIAL'
      : `COPY EDITORIAL · ${context.competitionName} · ${context.stageLabel} · ${context.seasonLabel}`;
  const origin = `${writerLabel(pkg.writer)} · ${
    pkg.research.mode === 'verified_research' ? editorialCopy.researchVerified : editorialCopy.researchLocal
  }`;
  return `${[heading, origin, `Descargado: ${formatDateTime(downloadedAt.toISOString())}`, ...sections].join('\n\n')}\n`;
}

/** A file name from the competition and stage, ASCII letters, digits and hyphens only. */
export function editorialFileName(pkg: EditorialPackage): string {
  const words = pkg.context === null ? '' : `${pkg.context.competitionName} ${pkg.context.stageLabel}`;
  const slug = words
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60)
    .replace(/-+$/u, '');
  return slug === '' ? 'copy-editorial.txt' : `copy-editorial-${slug}.txt`;
}

/** Copies a text to the clipboard; false when the browser refuses (the operator copies it by hand). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await globalThis.navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Saves a file from a same-origin address (for example one slide image) without leaving the page. */
export function saveUrl(url: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/** Saves a text file through a temporary object URL (the same way as the carousel ZIP). */
export function saveTextFile(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
