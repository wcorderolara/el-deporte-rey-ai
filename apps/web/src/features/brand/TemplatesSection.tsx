import { LanguageSchema, type Language, type Template } from '@edr/contracts';
import { useCallback, useId, useState } from 'react';

import { ErrorBanner } from '../../ui';
import type { BrandApi } from './brandApi';
import styles from './Brand.module.css';
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
    <li className={styles.card}>
      <h3 className={styles.cardTitle}>{template.label}</h3>
      <dl className={styles.details}>
        <dt>{templatesCopy.identifier}</dt>
        <dd>
          <code className={styles.code}>{template.id}</code>
        </dd>
        <dt>{templatesCopy.version}</dt>
        <dd>{template.version}</dd>
        <dt>{templatesCopy.slideType}</dt>
        <dd>{slideTypeLabel[template.slideType]}</dd>
        <dt>{templatesCopy.badgeSlots}</dt>
        <dd>
          {template.badgeSlots > 0 ? templatesCopy.badgeSlotsValue(template.badgeSlots) : templatesCopy.badgeSlotsNone}
        </dd>
        <dt>{templatesCopy.imageSlots}</dt>
        <dd>
          {template.imageSlots.length === 0 ? (
            templatesCopy.imageSlotsNone
          ) : (
            <>
              {template.imageSlots.map((kind) => assetKindLabel[kind]).join(', ')}. {templatesCopy.imageSlotsNote}
            </>
          )}
        </dd>
      </dl>
      <figure className={styles.figure}>
        <PreviewImage
          key={src}
          className={styles.templatePreview}
          src={src}
          alt={templatesCopy.previewAlt(template.label, languageName)}
          failedText={templatesCopy.previewFailed}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
        />
        <figcaption className={styles.caption}>{templatesCopy.previewCaption(languageName)}</figcaption>
      </figure>
    </li>
  );
}

export interface TemplatesSectionProps {
  api: BrandApi;
}

/**
 * Templates list (R-031, R-050; OD-13): version, slide type, reserved badge slots (always empty in the MVP, R-231),
 * image slots and a preview per language. Templates are versioned code; there is no editing control.
 */
export function TemplatesSection({ api }: TemplatesSectionProps) {
  const id = useId();
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const loadTemplates = useCallback((signal: AbortSignal) => api.listTemplates(signal), [api]);
  const { state, reload } = useResource(loadTemplates);

  return (
    <section className={styles.section} aria-labelledby="brand-templates-title">
      <h2 id="brand-templates-title">{templatesCopy.heading}</h2>
      <p className={styles.notice}>{templatesCopy.versioned}</p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{templatesCopy.languageLegend}</legend>
        <div className={styles.languages}>
          {LANGUAGES.map((value) => (
            <label key={value} className={styles.option}>
              <input
                type="radio"
                name={`${id}-language`}
                value={value}
                checked={language === value}
                onChange={() => setLanguage(value)}
              />
              <span>{languageLabel[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.status === 'loading' ? (
        <p role="status" aria-live="polite">
          {templatesCopy.loading}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <ErrorBanner error={state.error} title={templatesCopy.loadFailedTitle} onRetry={reload} />
      ) : null}
      {state.status === 'ready' && state.data.length === 0 ? <p>{templatesCopy.empty}</p> : null}
      {state.status === 'ready' && state.data.length > 0 ? (
        <ul className={styles.cards} aria-labelledby="brand-templates-title">
          {state.data.map((template) => (
            <TemplateCard key={template.id} api={api} template={template} language={language} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
