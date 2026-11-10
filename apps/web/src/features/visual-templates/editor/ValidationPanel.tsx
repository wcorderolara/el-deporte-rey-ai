import type { VisualTemplateIssue } from '@edr/contracts';
import { useEffect, useId, useRef, useState } from 'react';

import { Alert, Badge, Icon, classNames } from '../../../ui';
import { editorCopy, issueActionCopy } from '../copy';

export interface IssueListProps {
  issues: readonly VisualTemplateIssue[];
  /** Layer names by ID, to name the layer of an issue. */
  layerNames: ReadonlyMap<string, string>;
  onSelect: (layerId: string) => void;
  label: string;
}

/**
 * Issues with their severity, the layer concerned and the recommended action; an issue of a layer selects it. The
 * messages are the server's, as given; the recommendations are fixed by issue code.
 */
export function IssueList({ issues, layerNames, onSelect, label }: IssueListProps) {
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return (
    <ul aria-label={label} className="m-0 grid list-none gap-1 p-0">
      {sorted.map((issue, index) => {
        const name = issue.layerId === null ? null : (layerNames.get(issue.layerId) ?? issue.layerId);
        const action = issueActionCopy[issue.code];
        const content = (
          <>
            <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
              {issue.severity === 'error' ? editorCopy.errorTag : editorCopy.warningTag}
            </Badge>{' '}
            <span className="grid min-w-0 gap-0.5">
              <span className="text-body-sm text-text-primary">
                {name === null ? null : <strong>{name}:</strong>}
                {name === null ? null : ' '}
                {issue.message}
              </span>
              {action === undefined ? null : <span className="text-caption text-text-secondary">{action}</span>}
            </span>
          </>
        );
        return (
          <li key={`${issue.code}-${issue.layerId ?? ''}-${String(index)}`}>
            {issue.layerId === null || !layerNames.has(issue.layerId) ? (
              <p className="m-0 flex items-start gap-2 p-2">{content}</p>
            ) : (
              <button
                type="button"
                className="focus-studio m-0 flex w-full cursor-pointer items-start gap-2 rounded-control border-0 bg-transparent p-2 text-left font-sans hover:bg-surface-card"
                onClick={() => onSelect(issue.layerId ?? '')}
              >
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface ValidationPanelProps {
  issues: readonly VisualTemplateIssue[];
  /** True while the draft has changes the server has not validated. */
  stale: boolean;
  layerNames: ReadonlyMap<string, string>;
  onSelect: (layerId: string) => void;
}

/** The server validation of the saved version: errors block publication, warnings are for the operator to decide. */
export function ValidationPanel({ issues, stale, layerNames, onSelect }: ValidationPanelProps) {
  return (
    <div className="grid gap-3">
      {stale ? <Alert tone="warning">{editorCopy.validationStale}</Alert> : null}
      {issues.length === 0 ? (
        <p className="m-0 text-body-sm text-text-secondary">{editorCopy.validationOk}</p>
      ) : (
        <IssueList issues={issues} layerNames={layerNames} onSelect={onSelect} label={editorCopy.validation} />
      )}
      <p className="m-0 text-caption text-text-subtle">{editorCopy.validationNote}</p>
    </div>
  );
}

/** The summary of the validation: no issues, or the count of errors and warnings. */
export function validationSummary(issues: readonly VisualTemplateIssue[]): {
  text: string;
  tone: 'success' | 'warning' | 'danger';
} {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  if (issues.length === 0) return { text: editorCopy.validationOkShort, tone: 'success' };
  const parts = [errors > 0 ? editorCopy.errors(errors) : null, warnings > 0 ? editorCopy.warnings(warnings) : null];
  return { text: parts.filter((part) => part !== null).join(' · '), tone: errors > 0 ? 'danger' : 'warning' };
}

const indicatorTone = {
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  danger: 'border-danger/50 text-danger',
} as const;

/**
 * The compact validation indicator of the toolbar: «Sin errores», or the count of errors and warnings. It opens a
 * panel with the issues; choosing one selects its layer and closes the panel. Escape or a click outside close it.
 */
export function ValidationIndicator(props: ValidationPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const summary = validationSummary(props.issues);

  useEffect(() => {
    if (!open) return;
    function outside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative font-sans text-body-sm font-bold"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={editorCopy.validationButton(summary.text, props.stale)}
        className={classNames(
          'focus-studio m-0 inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-control border border-solid',
          'bg-surface-card px-3 py-1.5 font-sans text-body-sm font-bold transition-colors duration-fast hover:bg-surface-overlay',
          indicatorTone[summary.tone],
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={summary.tone === 'success' ? 'check' : 'alert'} size={18} />
        <span className="whitespace-nowrap">{summary.text}</span>
        {props.stale ? <span className="size-2 rounded-full bg-warning" aria-hidden="true" /> : null}
        <Icon name="chevron-down" size={16} />
      </button>
      <section
        id={panelId}
        aria-label={editorCopy.validation}
        hidden={!open}
        className="absolute top-full right-0 z-40 mt-2 max-h-[min(32rem,70vh)] w-[min(26rem,90vw)] overflow-y-auto rounded-xl border border-border-subtle bg-surface-raised p-3 shadow-overlay"
      >
        <h2 className="m-0 mb-2 font-display text-body-md font-bold text-text-primary">{editorCopy.validation}</h2>
        <ValidationPanel
          {...props}
          onSelect={(layerId) => {
            props.onSelect(layerId);
            setOpen(false);
          }}
        />
      </section>
    </div>
  );
}
