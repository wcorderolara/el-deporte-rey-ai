import { attestedCopy } from './copy';

/** Operator-attested label of exported content that uses MANUALLY_APPROVED facts (OD-28). */
export function AttestedNote() {
  return (
    <div
      className="grid gap-1 rounded-control border-2 border-dashed border-brand-purple border-l-4 bg-surface-subtle px-3 py-2 text-text-primary"
      role="note"
      aria-label={attestedCopy.title}
      data-testid="attested-note"
    >
      <p className="m-0">
        <strong>
          <span aria-hidden="true">✎ </span>
          {attestedCopy.title}
        </strong>
      </p>
      <p className="m-0 text-body-sm text-text-secondary">{attestedCopy.body}</p>
    </div>
  );
}
