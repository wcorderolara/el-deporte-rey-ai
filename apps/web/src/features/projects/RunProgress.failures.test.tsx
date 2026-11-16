/**
 * UI-06.3 errors and recovery in the run view: a run stopped by a timeout of the source, by a server restart
 * (`interrupted`) or by an internal error (for example a missing graphic resource while rendering) shows the failed
 * stage and the reason as fixed Spanish text with a symbol, never the closed code or any server detail, and the
 * stages that did not run as skipped.
 */
import type { Failure, Run, StageStatus } from '@edr/contracts';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RunProgress } from './RunProgress';

afterEach(cleanup);

const AT = '2026-10-27T12:00:00.000Z';
const STAGES = ['research', 'verification', 'content', 'rendering', 'visual_qa'] as const;

function failedRun(failedStage: (typeof STAGES)[number], failure: Failure, kind: Run['kind'] = 'full'): Run {
  const index = STAGES.indexOf(failedStage);
  const stages: StageStatus[] = STAGES.map((stage, position) => ({
    stage,
    status: position < index ? 'completed' : position === index ? 'failed' : 'skipped',
    startedAt: position <= index ? AT : null,
    finishedAt: position <= index ? AT : null,
    failure: position === index ? failure : null,
  }));
  return {
    id: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    runNumber: 3,
    kind,
    status: 'failed',
    startedAt: AT,
    finishedAt: AT,
    failure,
    stages,
  };
}

function stageRow(label: string): HTMLElement {
  return screen.getByRole('rowheader', { name: label }).closest('tr') as HTMLElement;
}

describe('RunProgress: failed runs explain the reason in Spanish', () => {
  it.each([
    [
      'research',
      { code: 'timeout', sourceId: 'demo-a', path: null, httpStatus: null },
      'Obtención de datos',
      'La fuente de datos no respondió a tiempo.',
    ],
    [
      'content',
      { code: 'interrupted', sourceId: null, path: null, httpStatus: null },
      'Redacción del contenido',
      'La ejecución se interrumpió porque el servidor local se detuvo.',
    ],
    [
      'rendering',
      { code: 'internal', sourceId: null, path: null, httpStatus: null },
      'Generación de imágenes',
      'Ocurrió un error interno en el servidor local.',
    ],
  ] as const)('a %s failure (%o) names the stage, the reason and the skipped stages', (stage, failure, label, text) => {
    render(<RunProgress run={failedRun(stage, failure)} />);
    expect(screen.getByRole('heading', { name: 'Ejecución 3 (completa)' })).toBeTruthy();
    const reason = screen.getByText('Motivo del fallo:').parentElement as HTMLElement;
    expect(reason.textContent).toContain(text);
    expect(reason.textContent).not.toContain(failure.code);

    const table = screen.getByRole('table', { name: 'Estado de cada etapa' });
    const row = stageRow(label);
    expect(within(row).getByText('Fallida')).toBeTruthy();
    expect(row.textContent).toContain('✕');
    expect(row.textContent).toContain(text);
    if (failure.sourceId !== null) expect(row.textContent).toContain(`Fuente: ${failure.sourceId}`);
    const index = STAGES.indexOf(stage);
    const laterRows = within(table)
      .getAllByRole('row')
      .slice(index + 2);
    for (const later of laterRows) {
      expect(later.textContent).toContain('Omitida');
      expect(later.textContent).toContain('Sin iniciar');
    }
    // Only fixed text: no closed code, stack or path reaches the page.
    expect(document.body.textContent).not.toMatch(/\binternal\b|\binterrupted\b|\btimeout\b|Error:|\/tmp|\.png/);
  });
});
