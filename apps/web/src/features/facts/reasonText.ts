/**
 * Localized reason texts of a fact (R-416 Spanish by default; OD-63 F-2), built only from the closed codes of the
 * contract `Fact`: `status`, `unverifiedReason`, `blockReason` and, for a verified fact, the dispute `outcome`. The
 * server's `reason` is fixed English text with source parameters; it is shown only where no closed code covers the
 * case: an unverified fact whose `unverifiedReason` is null (the contract allows the null but gives no code for it).
 * The sources behind a status are listed in the evidence table of the fact, so no source name is repeated here.
 *
 * Wording rules (BR-12, BR-17, OD-17, PD-17): a MANUALLY_APPROVED fact is never presented as verified; its texts do not
 * use the words "verificado", "verificación", "verified" or "verification" at all. Every text renders as text only.
 */
import type { BlockReason, Fact, Language } from '@edr/contracts';

import type { UnverifiedReason } from '../../api/types';

/**
 * Language of the operator interface: Spanish, the default (PD-06, BR-07). The interface has no language switch (the
 * document is `lang="es"` and every feature's copy is Spanish); a project's content language governs generated
 * content (R-051, R-310), not the interface. Components take a `language` prop that defaults to this value.
 */
export const UI_LANGUAGE: Language = 'es';

interface ReasonTable {
  verified: string;
  verifiedAfterDispute: string;
  manuallyApproved: string;
  unverified: Record<UnverifiedReason, string>;
  /** An unverified fact with neither a reason code nor a server reason. */
  unverifiedNoReason: string;
}

export const factReasonTable: Record<Language, ReasonTable> = {
  es: {
    verified: 'Verificado: fuentes aceptadas independientes coinciden en el valor.',
    verifiedAfterDispute:
      'Verificado tras una disputa: la publicación oficial y otra fuente aceptada independiente coinciden.',
    manuallyApproved:
      'Aprobado manualmente: el operador atestigua el valor importado. No cuenta como fuente aceptada ni como ' +
      'segunda fuente.',
    unverified: {
      awaiting_independent_verification:
        'Sin verificar: pendiente de verificación independiente; el valor tiene el respaldo de una sola fuente ' +
        'aceptada independiente.',
      disputed:
        'Sin verificar: en disputa; las fuentes aceptadas no coinciden y el dato no se verifica mientras la disputa ' +
        'no se resuelva.',
      no_accepted_source: 'Sin verificar: ninguna fuente aceptada aporta un valor para este dato.',
      team_identity_unmatched: 'Sin verificar: un equipo de este dato no está identificado en todas las fuentes.',
    },
    unverifiedNoReason: 'Sin verificar: el servidor no indica el motivo.',
  },
  en: {
    verified: 'Verified: independent accepted sources agree on the value.',
    verifiedAfterDispute:
      'Verified after a dispute: the official publication and another independent accepted source agree.',
    manuallyApproved:
      'Manually approved: the operator attests the imported value. It does not count as an accepted source or as a ' +
      'second source.',
    unverified: {
      awaiting_independent_verification:
        'Unverified: awaiting independent verification; the value is supported by only one independent accepted ' +
        'source.',
      disputed:
        'Unverified: disputed; the accepted sources disagree and the fact stays unverified until it is resolved.',
      no_accepted_source: 'Unverified: no accepted source provides a value for this fact.',
      team_identity_unmatched: 'Unverified: a team of this fact is not identified in every source.',
    },
    unverifiedNoReason: 'Unverified: the server gives no reason.',
  },
};

/** BlockReason: the sentence that follows "blocks publication approval of content using it". */
export const blockReasonTable: Record<Language, Record<BlockReason, string>> = {
  es: {
    not_verified: 'el dato no está verificado.',
    manually_approved_not_publishable:
      'la aprobación manual solo permite publicar en competiciones configuradas sin fuente pública aceptada, y esta ' +
      'competición no lo está.',
    publication_permission_unconfirmed: 'permiso de republicación no confirmado.',
  },
  en: {
    not_verified: 'the fact is not verified.',
    manually_approved_not_publishable:
      'manual approval allows publication only in competitions configured as having no accepted public source, and ' +
      'this competition is not.',
    publication_permission_unconfirmed: 'republishing permission not confirmed.',
  },
};

/** A text to show, with its language (the server's reason is English) and its origin. */
export interface ReasonText {
  text: string;
  lang: Language;
  /** `code`: built from the closed codes; `server`: the server's text, shown because no code covers the case. */
  origin: 'code' | 'server';
}

export type FactReasonInput = Pick<Fact, 'status' | 'unverifiedReason' | 'reason' | 'dispute'>;

/** Reason of a fact's status in `language`, from its closed codes (see the module comment for the one fallback). */
export function factReasonText(fact: FactReasonInput, language: Language = UI_LANGUAGE): ReasonText {
  const table = factReasonTable[language];
  const coded = (text: string): ReasonText => ({ text, lang: language, origin: 'code' });
  switch (fact.status) {
    case 'verified':
      return coded(fact.dispute?.outcome === 'resolved' ? table.verifiedAfterDispute : table.verified);
    case 'manually_approved':
      return coded(table.manuallyApproved);
    case 'unverified':
      if (fact.unverifiedReason !== null) {
        return coded(table.unverified[fact.unverifiedReason]);
      }
      if (fact.reason !== null && fact.reason.trim() !== '') {
        return { text: fact.reason, lang: 'en', origin: 'server' };
      }
      return coded(table.unverifiedNoReason);
  }
}

/** Why a fact blocks publication approval, in `language`. */
export function blockReasonText(reason: BlockReason, language: Language = UI_LANGUAGE): string {
  return blockReasonTable[language][reason];
}
