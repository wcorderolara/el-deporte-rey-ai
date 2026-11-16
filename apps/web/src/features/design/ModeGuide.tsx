import type { DesignMode } from '@edr/contracts';

import { guideCopy, modeGuide, modeLabel, type ModeGuide as Guide } from './copy';

const MODES: readonly DesignMode[] = ['guided', 'own_prompt'];
const ROWS = Object.keys(guideCopy.rows) as (keyof Guide)[];

/** Side-by-side comparison of the two generation modes (PD-ARCH-01G-B): what each one is for and what it does. */
export function ModeGuide({ highlight }: { highlight?: DesignMode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full border-collapse text-left text-body-sm">
        <caption className="sr-only">{guideCopy.title}</caption>
        <thead>
          <tr className="border-b border-border-subtle">
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">{guideCopy.title}</span>
            </th>
            {MODES.map((mode) => (
              <th
                key={mode}
                scope="col"
                className={`px-3 py-2 text-text-primary ${highlight === mode ? 'bg-surface-card text-brand-gold' : ''}`}
              >
                {modeLabel[mode]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row} className="border-b border-border-subtle align-top last:border-0">
              <th scope="row" className="px-3 py-2 text-caption font-bold text-text-secondary">
                {guideCopy.rows[row]}
              </th>
              {MODES.map((mode) => (
                <td key={mode} className={`px-3 py-2 text-text-primary ${highlight === mode ? 'bg-surface-card' : ''}`}>
                  {modeGuide[mode][row]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
