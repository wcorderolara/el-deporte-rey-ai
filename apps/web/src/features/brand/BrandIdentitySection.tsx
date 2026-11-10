import type { BrandColorRole, BrandFontRole, BrandIdentity } from '@edr/contracts';
import { contractRegExp } from '@edr/contracts';
import { useCallback, useId, useRef, useState } from 'react';

import { Badge, Button, Card, ErrorBanner, Input, LoadingState, Textarea } from '../../ui';
import type { BrandApi, UpdateIdentityInput } from './brandApi';
import { BrandViewHeader } from './BrandViewHeader';
import { identityCopy, uploadCopy } from './copy';
import { nullableText } from './library';
import { useResource } from './useResource';

export interface BrandIdentitySectionProps {
  api: BrandApi;
  announce: (message: string) => void;
}

const NOTE = contractRegExp('Note');

interface IdentityDraft {
  description: string;
  graphicPreferences: string;
  colorUsage: Record<BrandColorRole, string>;
  typographyUsage: Record<BrandFontRole, string>;
}

function draftOf(identity: BrandIdentity): IdentityDraft {
  return {
    description: identity.description ?? '',
    graphicPreferences: identity.graphicPreferences ?? '',
    colorUsage: Object.fromEntries(identity.palette.map((color) => [color.role, color.usage ?? ''])) as Record<
      BrandColorRole,
      string
    >,
    typographyUsage: Object.fromEntries(identity.typography.map((font) => [font.role, font.usage ?? ''])) as Record<
      BrandFontRole,
      string
    >,
  };
}

function noteError(value: string, max: number): string | undefined {
  const text = value.trim();
  if (text === '') return undefined;
  if ([...text].length > max) return identityCopy.tooLong(max);
  return NOTE.test(text) ? undefined : uploadCopy.textInvalid;
}

/**
 * Brand identity (PD-ARCH-01G-A): name, handle and mascot name, the official palette and the fonts exactly as the
 * slide renderer uses them (read only: one source, no duplicated colours), and the editable description, graphic
 * preferences and usage notes that will give context to later AI work.
 */
export function BrandIdentitySection({ api, announce }: BrandIdentitySectionProps) {
  const headingId = useId();
  const load = useCallback((signal: AbortSignal) => api.getIdentity(signal), [api]);
  const { state, reload, update } = useResource(load);
  const [draft, setDraft] = useState<IdentityDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const controller = useRef<AbortController | null>(null);
  const identity = state.status === 'ready' ? state.data : null;

  const errors: Record<string, string | undefined> =
    draft === null
      ? {}
      : {
          description: noteError(draft.description, 1000),
          graphicPreferences: noteError(draft.graphicPreferences, 2000),
          ...Object.fromEntries(
            Object.entries(draft.colorUsage).map(([role, value]) => [`color-${role}`, noteError(value, 300)]),
          ),
          ...Object.fromEntries(
            Object.entries(draft.typographyUsage).map(([role, value]) => [`font-${role}`, noteError(value, 300)]),
          ),
        };
  const invalid = Object.values(errors).some((value) => value !== undefined);

  async function save() {
    if (draft === null || invalid || saving) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const input: UpdateIdentityInput = {
      description: nullableText(draft.description),
      graphicPreferences: nullableText(draft.graphicPreferences),
      colorUsage: Object.fromEntries(
        Object.entries(draft.colorUsage).map(([role, value]) => [role, nullableText(value)]),
      ) as UpdateIdentityInput['colorUsage'],
      typographyUsage: Object.fromEntries(
        Object.entries(draft.typographyUsage).map(([role, value]) => [role, nullableText(value)]),
      ) as UpdateIdentityInput['typographyUsage'],
    };
    setSaving(true);
    setFailure(null);
    try {
      const saved = await api.updateIdentity(input, current.signal);
      if (current.signal.aborted) return;
      update(() => saved);
      setDraft(null);
      announce(identityCopy.saved);
    } catch (error) {
      if (!current.signal.aborted) setFailure(error);
    } finally {
      if (!current.signal.aborted) setSaving(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-6">
      <BrandViewHeader headingId={headingId} heading={identityCopy.heading} intro={identityCopy.intro} />
      {state.status === 'loading' ? (
        <Card className="min-h-24">
          <LoadingState layout="panel" label={identityCopy.loading} />
        </Card>
      ) : null}
      {state.status === 'error' ? (
        <ErrorBanner error={state.error} title={identityCopy.loadFailedTitle} onRetry={reload} />
      ) : null}
      {identity === null ? null : (
        <Card className="grid gap-6">
          <dl className="m-0 grid gap-3 text-body-sm sm:grid-cols-3">
            <div>
              <dt className="text-caption font-bold text-text-secondary">{identityCopy.name}</dt>
              <dd className="m-0 text-body-md font-bold text-text-primary">{identity.name}</dd>
            </div>
            <div>
              <dt className="text-caption font-bold text-text-secondary">{identityCopy.handle}</dt>
              <dd className="m-0 text-text-primary">{identity.handle}</dd>
            </div>
            <div>
              <dt className="text-caption font-bold text-text-secondary">{identityCopy.mascot}</dt>
              <dd className="m-0 text-text-primary">{identity.mascotName ?? '—'}</dd>
            </div>
          </dl>
          {identity.provisional ? (
            <p className="m-0">
              <Badge tone="warning">{identityCopy.provisional}</Badge>
            </p>
          ) : null}

          <section aria-label={identityCopy.palette} className="grid gap-3">
            <h3 className="m-0 text-body-lg font-bold text-text-primary">{identityCopy.palette}</h3>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-5">
              {identity.palette.map((color) => (
                <li key={color.role} className="grid gap-2 rounded-xl border border-border-subtle bg-surface-card p-3">
                  {/* The swatch shows the configured value; the value is a contract-validated hex colour. */}
                  <span
                    aria-hidden="true"
                    className="h-14 rounded-lg border border-border-subtle"
                    style={{ backgroundColor: color.value }}
                  />
                  <span className="text-body-sm font-bold text-text-primary">{identityCopy.colorRole[color.role]}</span>
                  <code className="text-caption text-text-secondary">{color.value.toUpperCase()}</code>
                  {draft === null ? (
                    <span className="text-caption text-text-secondary">{color.usage ?? identityCopy.noUsage}</span>
                  ) : (
                    <Input
                      id={`${headingId}-color-${color.role}`}
                      label={identityCopy.usage}
                      value={draft.colorUsage[color.role]}
                      maxLength={300}
                      disabled={saving}
                      error={errors[`color-${color.role}`]}
                      onChange={(event) =>
                        setDraft({ ...draft, colorUsage: { ...draft.colorUsage, [color.role]: event.target.value } })
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label={identityCopy.typography} className="grid gap-3">
            <h3 className="m-0 text-body-lg font-bold text-text-primary">{identityCopy.typography}</h3>
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
              {identity.typography.map((font) => (
                <li key={font.role} className="grid gap-2 rounded-xl border border-border-subtle bg-surface-card p-3">
                  <span className="text-body-sm font-bold text-text-primary">{identityCopy.fontRole[font.role]}</span>
                  <span
                    className="text-heading-sm text-text-primary"
                    style={{ fontFamily: font.family, fontWeight: font.weight }}
                  >
                    {identityCopy.fontSample}
                  </span>
                  <span className="text-caption text-text-secondary">
                    {font.family} · {identityCopy.weight(font.weight)}
                  </span>
                  {draft === null ? (
                    <span className="text-caption text-text-secondary">{font.usage ?? identityCopy.noUsage}</span>
                  ) : (
                    <Input
                      id={`${headingId}-font-${font.role}`}
                      label={identityCopy.usage}
                      value={draft.typographyUsage[font.role]}
                      maxLength={300}
                      disabled={saving}
                      error={errors[`font-${font.role}`]}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          typographyUsage: { ...draft.typographyUsage, [font.role]: event.target.value },
                        })
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
            <p className="m-0 text-caption text-text-secondary">{identityCopy.fontNote}</p>
          </section>

          {draft === null ? (
            <div className="grid gap-4">
              <div>
                <h3 className="m-0 text-body-sm font-bold text-text-secondary">{identityCopy.description}</h3>
                <p className="m-0 mt-1 whitespace-pre-line text-body-md text-text-primary">
                  {identity.description ?? identityCopy.noUsage}
                </p>
              </div>
              <div>
                <h3 className="m-0 text-body-sm font-bold text-text-secondary">{identityCopy.preferences}</h3>
                <p className="m-0 mt-1 whitespace-pre-line text-body-md text-text-primary">
                  {identity.graphicPreferences ?? identityCopy.noUsage}
                </p>
              </div>
              <div>
                <Button variant="secondary" onClick={() => setDraft(draftOf(identity))}>
                  {identityCopy.edit}
                </Button>
              </div>
            </div>
          ) : (
            <form
              noValidate
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <Textarea
                id={`${headingId}-description`}
                label={identityCopy.description}
                value={draft.description}
                maxLength={1000}
                rows={3}
                disabled={saving}
                error={errors['description']}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
              <Textarea
                id={`${headingId}-preferences`}
                label={identityCopy.preferences}
                description={identityCopy.preferencesHint}
                value={draft.graphicPreferences}
                maxLength={2000}
                rows={4}
                disabled={saving}
                error={errors['graphicPreferences']}
                onChange={(event) => setDraft({ ...draft, graphicPreferences: event.target.value })}
              />
              {failure === null ? null : (
                <ErrorBanner error={failure} title={identityCopy.saveFailedTitle} onRetry={() => void save()} />
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" isLoading={saving} loadingLabel={identityCopy.saving} disabled={invalid}>
                  {identityCopy.save}
                </Button>
                <Button variant="secondary" disabled={saving} onClick={() => setDraft(null)}>
                  {identityCopy.cancel}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </section>
  );
}
