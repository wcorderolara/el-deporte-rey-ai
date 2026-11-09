import type { VisualTemplateIssue } from '@edr/contracts';

import { Alert, Badge } from '../../../ui';
import { editorCopy } from '../copy';

export interface IssueListProps {
  issues: readonly VisualTemplateIssue[];
  /** Layer names by ID, to name the layer of an issue. */
  layerNames: ReadonlyMap<string, string>;
  onSelect: (layerId: string) => void;
  label: string;
}

/** Issues with their severity; an issue of a layer selects it. The messages are the server's, as given. */
export function IssueList({ issues, layerNames, onSelect, label }: IssueListProps) {
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return (
    <ul aria-label={label} className="m-0 grid list-none gap-2 p-0">
      {sorted.map((issue, index) => {
        const name = issue.layerId === null ? null : (layerNames.get(issue.layerId) ?? issue.layerId);
        const content = (
          <>
            <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
              {issue.severity === 'error' ? editorCopy.errorTag : editorCopy.warningTag}
            </Badge>{' '}
            <span className="min-w-0 text-body-sm text-text-primary">
              {name === null ? null : <strong>{name}:</strong>}
              {name === null ? null : ' '}
              {issue.message}
            </span>
          </>
        );
        return (
          <li key={`${issue.code}-${issue.layerId ?? ''}-${String(index)}`}>
            {issue.layerId === null || !layerNames.has(issue.layerId) ? (
              <p className="m-0 flex items-start gap-2">{content}</p>
            ) : (
              <button
                type="button"
                className="focus-studio flex w-full cursor-pointer items-start gap-2 rounded-lg border-0 bg-transparent p-0 text-left"
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
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  return (
    <div className="grid gap-3">
      <p className="m-0 flex flex-wrap gap-2">
        <Badge tone={errors > 0 ? 'danger' : 'success'}>{editorCopy.errors(errors)}</Badge>
        <Badge tone={warnings > 0 ? 'warning' : 'neutral'}>{editorCopy.warnings(warnings)}</Badge>
      </p>
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
