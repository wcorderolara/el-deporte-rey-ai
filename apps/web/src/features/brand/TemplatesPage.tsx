import { LanguageSchema, type DesignProposal, type Language, type Template } from '@edr/contracts';
import { useCallback, useId, useState } from 'react';
import { Link } from 'react-router';

import { Badge, Card, EmptyState, ErrorBanner, LoadingState } from '../../ui';
import { DesignProposalsSection } from '../design/DesignProposalsSection';
import type { DesignApi } from '../design/designApi';
import { CreateTemplateDialog } from '../visual-templates/CreateTemplateDialog';
import { VisualTemplatesSection } from '../visual-templates/VisualTemplatesSection';
import type { VisualTemplatesApi } from '../visual-templates/visualTemplatesApi';
import type { BrandApi } from './brandApi';
import { assetKindLabel, languageLabel, slideTypeLabel, templatesCopy } from './copy';
import { PreviewImage } from './PreviewImage';
import { useResource } from './useResource';

const LANGUAGES: readonly Language[] = LanguageSchema.options;

/** Spanish is the default language (PD-06). */
const DEFAULT_LANGUAGE: Language = 'es';

/** Slide size of the previews (architecture: 1080 x 1350). */
const PREVIEW_WIDTH = 1080;
const PREVIEW_HEIGHT = 1350;

interface TemplateCardProps {
  api: BrandApi;
  template: Template;
  language: Language;
}

function TemplateCard({ api, template, language }: TemplateCardProps) {
  const src = api.templatePreviewUrl(template.id, language);
  const languageName = languageLabel[language].toLowerCase();
  return (
    <li className="min-w-0">
      <Card as="article" aria-label={template.label} className="flex h-full min-w-0 flex-col gap-4">
        <figure className="m-0 grid gap-2">
          <span className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas">
            <PreviewImage
              key={src}
              className="absolute inset-0 h-full w-full object-contain"
              src={src}
              alt={templatesCopy.previewAlt(template.label, languageName)}
              failedText={templatesCopy.previewFailed}
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
            />
          </span>
          <figcaption className="text-caption text-text-subtle">
            {templatesCopy.previewCaption(languageName)}
          </figcaption>
        </figure>
        <div className="grid gap-1">
          <p className="m-0 text-caption font-bold tracking-label text-info uppercase">
            {slideTypeLabel[template.slideType]}
          </p>
          <h3 className="m-0 font-display text-heading-sm font-extrabold break-words text-text-primary">
            {template.label}
          </h3>
          <span className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">{templatesCopy.versionBadge(template.version)}</Badge>
          </span>
        </div>
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body-sm">
          <dt className="font-bold text-text-secondary">{templatesCopy.identifier}</dt>
          <dd className="m-0 break-words text-text-primary">
            <code className="font-mono text-caption">{template.id}</code>
          </dd>
          <dt className="font-bold text-text-secondary">{templatesCopy.version}</dt>
          <dd className="m-0 text-text-primary">{template.version}</dd>
          <dt className="font-bold text-text-secondary">{templatesCopy.slideType}</dt>
          <dd className="m-0 text-text-primary">{slideTypeLabel[template.slideType]}</dd>
          <dt className="font-bold text-text-secondary">{templatesCopy.badgeSlots}</dt>
          <dd className="m-0 text-text-primary">
            {template.badgeSlots > 0
              ? templatesCopy.badgeSlotsValue(template.badgeSlots)
              : templatesCopy.badgeSlotsNone}
          </dd>
          <dt className="font-bold text-text-secondary">{templatesCopy.imageSlots}</dt>
          <dd className="m-0 text-text-primary">
            {template.imageSlots.length === 0 ? (
              templatesCopy.imageSlotsNone
            ) : (
              <>
                {template.imageSlots.map((kind) => assetKindLabel[kind]).join(', ')}. {templatesCopy.imageSlotsNote}
              </>
            )}
          </dd>
        </dl>
      </Card>
    </li>
  );
}

export interface TemplatesHeaderProps {
  /** The heading of the view (level 1). */
  heading: string;
  /** What the view is for. */
  intro: string;
  headingId: string;
}

/** The header shared by the two template views: eyebrow, title, purpose and the link to Mi marca. */
function TemplatesHeader({ heading, intro, headingId }: TemplatesHeaderProps) {
  return (
    <div className="grid max-w-reading gap-3">
      <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">{templatesCopy.eyebrow}</p>
      <h1 id={headingId} className="m-0 font-display text-heading-md font-extrabold tracking-display text-text-primary">
        {heading}
      </h1>
      <p className="m-0 text-body-md text-text-secondary">{intro}</p>
      <p className="m-0 text-body-sm text-text-secondary">
        {templatesCopy.brandNote}{' '}
        <Link to="/brand" className="focus-studio text-text-link underline underline-offset-2">
          {templatesCopy.brandLink}
        </Link>
        .
      </p>
    </div>
  );
}

export interface CreateTemplatesPageProps {
  /** The brand library (assets of the proposals and the dialogs). */
  api: BrandApi;
  /** The AI design proposals (PD-ARCH-01G-B). */
  designApi: DesignApi;
  /** The structured visual templates (PD-ARCH-01G-C), made from approved proposals. */
  visualApi: VisualTemplatesApi;
}

/**
 * «Crear plantilla» (`/templates/create`): the structured visual templates (editable, versioned, made from approved
 * proposals) and the AI design proposals they start from, with the dialog that turns an approved proposal into a
 * template.
 */
export function CreateTemplatesPage({ api, designApi, visualApi }: CreateTemplatesPageProps) {
  /** "Crear plantilla" open, with the proposal chosen beforehand (or none). */
  const [creating, setCreating] = useState<{ proposalId: string | null } | null>(null);

  return (
    <section aria-labelledby="templates-create-title" className="grid min-w-0 gap-8">
      <TemplatesHeader
        headingId="templates-create-title"
        heading={templatesCopy.createHeading}
        intro={templatesCopy.createIntro}
      />
      <VisualTemplatesSection api={visualApi} onCreate={() => setCreating({ proposalId: null })} />
      <DesignProposalsSection
        api={designApi}
        brandApi={api}
        onCreateTemplate={(proposal: DesignProposal) => setCreating({ proposalId: proposal.id })}
      />
      {creating === null ? null : (
        <CreateTemplateDialog
          api={visualApi}
          designApi={designApi}
          initialProposalId={creating.proposalId}
          onClose={() => setCreating(null)}
        />
      )}
    </section>
  );
}

export interface EngineTemplatesPageProps {
  api: BrandApi;
}

/**
 * «Plantillas del motor» (`/templates/engine`; PD-ARCH-01G-A; R-031, R-050, R-231; OD-13): the built-in templates,
 * versioned code with no editing control: version, slide type, reserved badge slots (always empty in the MVP), image
 * slots and a preview per language. The brand assets they draw are managed in Mi marca.
 */
export function EngineTemplatesPage({ api }: EngineTemplatesPageProps) {
  const id = useId();
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const loadTemplates = useCallback((signal: AbortSignal) => api.listTemplates(signal), [api]);
  const { state, reload } = useResource(loadTemplates);

  return (
    <section aria-labelledby="engine-templates-title" className="grid min-w-0 gap-8">
      <TemplatesHeader
        headingId="engine-templates-title"
        heading={templatesCopy.engineHeading}
        intro={templatesCopy.versioned}
      />
      <section aria-labelledby={`${id}-list-title`} className="grid min-w-0 gap-5">
        <h2 id={`${id}-list-title`} className="m-0 font-display text-heading-sm font-extrabold text-text-primary">
          {templatesCopy.listLabel}
        </h2>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1 text-body-sm font-bold text-text-primary">{templatesCopy.languageLegend}</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((value) => (
              <label
                key={value}
                className={`flex min-h-touch items-center gap-2 rounded-xl border px-4 py-2 text-body-sm text-text-primary ${language === value ? 'border-brand-gold bg-surface-card' : 'border-border-subtle bg-surface-raised'}`}
              >
                <input
                  type="radio"
                  name={`${id}-language`}
                  value={value}
                  checked={language === value}
                  onChange={() => setLanguage(value)}
                />
                {languageLabel[value]}
              </label>
            ))}
          </div>
        </fieldset>

        {state.status === 'loading' ? <LoadingState layout="panel" label={templatesCopy.loading} /> : null}
        {state.status === 'error' ? (
          <ErrorBanner error={state.error} title={templatesCopy.loadFailedTitle} onRetry={reload} />
        ) : null}
        {state.status === 'ready' && state.data.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={templatesCopy.empty}
            description={templatesCopy.emptyDescription}
            icon="▥"
          />
        ) : null}
        {state.status === 'ready' && state.data.length > 0 ? (
          <ul
            aria-label={templatesCopy.listLabel}
            className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3"
          >
            {state.data.map((template) => (
              <TemplateCard key={template.id} api={api} template={template} language={language} />
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
