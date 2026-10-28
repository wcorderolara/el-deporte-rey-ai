/**
 * Localized fact reasons (OD-63 F-2, R-416, PD-17): every combination of status, unverified reason and dispute outcome
 * and every block reason, in Spanish and English; the server's reason only where no closed code covers the case; a
 * manually approved fact is never presented as verified.
 */
import { BlockReasonSchema, LanguageSchema, type Dispute, type Fact, type Language } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { UNVERIFIED_REASONS } from '../../api/types';
import { blockReasonLabel } from './copy';
import {
  blockReasonTable,
  blockReasonText,
  factReasonTable,
  factReasonText,
  UI_LANGUAGE,
  type FactReasonInput,
} from './reasonText';

const LANGUAGES = LanguageSchema.options;
const SERVER_REASON = 'Verified: independent accepted sources agree (demo-a, demo-b).';

function dispute(outcome: Dispute['outcome']): Dispute {
  return { sourceValues: [], consultedSourceId: null, consultedAt: null, outcome, resolvedValue: null };
}

function input(overrides: Partial<FactReasonInput>): FactReasonInput {
  return { status: 'verified', unverifiedReason: null, reason: SERVER_REASON, dispute: null, ...overrides };
}

const EXPECTED: Record<Language, Record<string, string>> = {
  es: {
    verified: 'Verificado: fuentes aceptadas independientes coinciden en el valor.',
    verifiedAfterDispute:
      'Verificado tras una disputa: la publicación oficial y otra fuente aceptada independiente coinciden.',
    manually_approved:
      'Aprobado manualmente: el operador atestigua el valor importado. No cuenta como fuente aceptada ni como ' +
      'segunda fuente.',
    awaiting_independent_verification:
      'Sin verificar: pendiente de verificación independiente; el valor tiene el respaldo de una sola fuente ' +
      'aceptada independiente.',
    disputed:
      'Sin verificar: en disputa; las fuentes aceptadas no coinciden y el dato no se verifica mientras la disputa no ' +
      'se resuelva.',
    no_accepted_source: 'Sin verificar: ninguna fuente aceptada aporta un valor para este dato.',
    team_identity_unmatched: 'Sin verificar: un equipo de este dato no está identificado en todas las fuentes.',
    unverifiedNoReason: 'Sin verificar: el servidor no indica el motivo.',
  },
  en: {
    verified: 'Verified: independent accepted sources agree on the value.',
    verifiedAfterDispute:
      'Verified after a dispute: the official publication and another independent accepted source agree.',
    manually_approved:
      'Manually approved: the operator attests the imported value. It does not count as an accepted source or as a ' +
      'second source.',
    awaiting_independent_verification:
      'Unverified: awaiting independent verification; the value is supported by only one independent accepted source.',
    disputed: 'Unverified: disputed; the accepted sources disagree and the fact stays unverified until it is resolved.',
    no_accepted_source: 'Unverified: no accepted source provides a value for this fact.',
    team_identity_unmatched: 'Unverified: a team of this fact is not identified in every source.',
    unverifiedNoReason: 'Unverified: the server gives no reason.',
  },
};

describe.each(LANGUAGES)('fact reasons in %s', (language) => {
  const expected = EXPECTED[language];

  it('verified, without a dispute or with a dispute that is not resolved', () => {
    for (const value of [null, dispute('unavailable'), dispute('same_source'), dispute('no_match')]) {
      expect(factReasonText(input({ status: 'verified', dispute: value }), language)).toEqual({
        text: expected.verified,
        lang: language,
        origin: 'code',
      });
    }
  });

  it('verified after a resolved dispute', () => {
    expect(factReasonText(input({ status: 'verified', dispute: dispute('resolved') }), language)).toEqual({
      text: expected.verifiedAfterDispute,
      lang: language,
      origin: 'code',
    });
  });

  it.each(UNVERIFIED_REASONS)('unverified, %s, with or without a dispute and a server reason', (reason) => {
    for (const value of [null, dispute('unavailable'), dispute('no_match')]) {
      for (const serverReason of [SERVER_REASON, null, '']) {
        expect(
          factReasonText(
            input({ status: 'unverified', unverifiedReason: reason, dispute: value, reason: serverReason }),
            language,
          ),
        ).toEqual({ text: expected[reason], lang: language, origin: 'code' });
      }
    }
  });

  it('manually approved: operator-attested, never presented as verified (PD-17)', () => {
    for (const serverReason of [SERVER_REASON, null]) {
      const text = factReasonText(input({ status: 'manually_approved', reason: serverReason }), language);
      expect(text).toEqual({ text: expected.manually_approved, lang: language, origin: 'code' });
      expect(text.text).not.toMatch(/verific/i);
    }
  });

  it('unverified without a reason code: the server reason (English) when given, otherwise a fixed text', () => {
    expect(
      factReasonText(input({ status: 'unverified', unverifiedReason: null, reason: 'Some server text.' }), language),
    ).toEqual({ text: 'Some server text.', lang: 'en', origin: 'server' });
    for (const serverReason of [null, '', '   ']) {
      expect(
        factReasonText(input({ status: 'unverified', unverifiedReason: null, reason: serverReason }), language),
      ).toEqual({ text: expected.unverifiedNoReason, lang: language, origin: 'code' });
    }
  });

  it('never shows the server reason when a closed code covers the case', () => {
    const statuses: FactReasonInput[] = [
      input({ status: 'verified' }),
      input({ status: 'verified', dispute: dispute('resolved') }),
      input({ status: 'manually_approved' }),
      ...UNVERIFIED_REASONS.map((reason) => input({ status: 'unverified', unverifiedReason: reason })),
    ];
    for (const fact of statuses) {
      expect(factReasonText(fact, language).text).not.toBe(SERVER_REASON);
    }
  });
});

describe('block reasons', () => {
  const expected: Record<Language, Record<string, string>> = {
    es: {
      not_verified: 'el dato no está verificado.',
      manually_approved_not_publishable:
        'la aprobación manual solo permite publicar en competiciones configuradas sin fuente pública aceptada, y ' +
        'esta competición no lo está.',
      publication_permission_unconfirmed: 'permiso de republicación no confirmado.',
    },
    en: {
      not_verified: 'the fact is not verified.',
      manually_approved_not_publishable:
        'manual approval allows publication only in competitions configured as having no accepted public source, ' +
        'and this competition is not.',
      publication_permission_unconfirmed: 'republishing permission not confirmed.',
    },
  };

  it.each(LANGUAGES)('every block reason in %s', (language) => {
    expect(Object.keys(blockReasonTable[language]).sort()).toEqual([...BlockReasonSchema.options].sort());
    for (const reason of BlockReasonSchema.options) {
      expect(blockReasonText(reason, language)).toBe(expected[language][reason]);
    }
  });

  it('keeps the Spanish table as the shared label of the feature', () => {
    expect(blockReasonLabel).toBe(blockReasonTable.es);
  });
});

describe('defaults and coverage', () => {
  it('uses Spanish, the interface language, by default (PD-06)', () => {
    expect(UI_LANGUAGE).toBe('es');
    expect(factReasonText(input({ status: 'verified' })).text).toBe(EXPECTED.es.verified);
    expect(blockReasonText('not_verified')).toBe('el dato no está verificado.');
  });

  it('has a text for every unverified reason in every language', () => {
    for (const language of LANGUAGES) {
      expect(Object.keys(factReasonTable[language].unverified).sort()).toEqual([...UNVERIFIED_REASONS].sort());
    }
  });

  it('accepts a full contract fact', () => {
    const fact = { status: 'unverified', unverifiedReason: 'disputed', reason: SERVER_REASON, dispute: null } as Pick<
      Fact,
      'status' | 'unverifiedReason' | 'reason' | 'dispute'
    >;
    expect(factReasonText(fact).text).toBe(EXPECTED.es.disputed);
  });
});
