import type { ImportCreate, ImportFileCreate, ImportFormCreate } from '@edr/contracts';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ApiError } from '../../api/client';
import { featureCopy } from '../../ui';
import { importsCopy, resultCopy } from './copy';
import { FileImportForm } from './FileImportForm';
import { FormImportForm } from './FormImportForm';
import { ImportHistory } from './ImportHistory';
import { ImportResult, type ImportOrigin, type ImportOutcome } from './ImportResult';
import type { ImportsApi } from './importsApi';
import styles from './Imports.module.css';
import { pairKey, seasonPairs, SelectionVersions } from './SelectionVersions';
import { useApiResource } from './useApiResource';

type Channel = 'file' | 'form';

interface SentRequest {
  body: ImportCreate;
  origin: ImportOrigin;
}

export interface ImportsPageProps {
  api: ImportsApi;
}

/**
 * Manual import page (`architecture.md` section 15.3): the file and form channels of createImport, the result of the
 * last import (applied, or rejected with every error), the import history with the originals, and the versions per
 * selection. Both forms stay mounted when the operator switches channel, so entries are not lost. Results are
 * announced in one polite status region and focus moves to the result heading.
 */
export function ImportsPage({ api }: ImportsPageProps) {
  const id = useId();
  const [channel, setChannel] = useState<Channel>('file');
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [lastRequest, setLastRequest] = useState<SentRequest | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [resultFocus, setResultFocus] = useState(0);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const history = useApiResource(
    'imports',
    useCallback((signal: AbortSignal) => api.listImports(signal), [api]),
  );

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (resultFocus > 0) {
      resultHeadingRef.current?.focus();
    }
  }, [resultFocus]);

  const { reload: reloadHistory } = history;
  const send = useCallback(
    async (request: SentRequest): Promise<boolean> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setSending(true);
      setLastRequest(request);
      setAnnouncement('');
      try {
        const summary = await api.createImport(request.body, controller.signal);
        if (controller.signal.aborted) {
          return false;
        }
        setOutcome({ status: 'applied', summary });
        setAnnouncement(resultCopy.appliedAnnouncement(summary.competitionName, summary.seasonLabel));
        setSelectedPair(pairKey(summary.competitionId, summary.seasonId));
        setRefreshToken((value) => value + 1);
        reloadHistory();
        return true;
      } catch (error) {
        if (controller.signal.aborted) {
          return false;
        }
        setOutcome({ status: 'failed', error, origin: request.origin });
        const rejected = error instanceof ApiError && error.problem?.code === 'IMPORT_REJECTED';
        setAnnouncement(rejected ? resultCopy.rejectedAnnouncement : resultCopy.failedTitle);
        return false;
      } finally {
        if (!controller.signal.aborted) {
          setSending(false);
          setResultFocus((value) => value + 1);
        }
      }
    },
    [api, reloadHistory],
  );

  const sendFile = useCallback(
    (body: ImportFileCreate) => send({ body, origin: { channel: body.channel, fileName: body.fileName } }),
    [send],
  );
  const sendForm = useCallback(
    (body: ImportFormCreate) => send({ body, origin: { channel: 'form', fileName: null } }),
    [send],
  );

  const pairs = history.state.status === 'ready' ? seasonPairs(history.state.data) : [];

  return (
    <section aria-labelledby="imports-title">
      <h1 id="imports-title">{featureCopy.imports}</h1>
      <p>{importsCopy.intro}</p>
      <p className={styles.notice}>{importsCopy.noPersons}</p>
      <p className={styles.notice}>{importsCopy.noDerivation}</p>
      <p className={styles.notice}>{importsCopy.versions}</p>
      <p className={styles.status} role="status" aria-live="polite" aria-label={importsCopy.statusRegion}>
        {announcement}
      </p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{importsCopy.channelLegend}</legend>
        <div className={styles.options}>
          <label className={styles.option}>
            <input
              type="radio"
              name={`${id}-channel`}
              value="file"
              checked={channel === 'file'}
              onChange={() => setChannel('file')}
            />
            {importsCopy.channelFile}
          </label>
          <label className={styles.option}>
            <input
              type="radio"
              name={`${id}-channel`}
              value="form"
              checked={channel === 'form'}
              onChange={() => setChannel('form')}
            />
            {importsCopy.channelForm}
          </label>
        </div>
      </fieldset>

      <div hidden={channel !== 'file'}>
        <FileImportForm sending={sending} onSend={sendFile} />
      </div>
      <div hidden={channel !== 'form'}>
        <FormImportForm sending={sending} onSend={sendForm} />
      </div>

      {outcome === null ? null : (
        <ImportResult
          outcome={outcome}
          headingRef={resultHeadingRef}
          {...(lastRequest === null || sending ? {} : { onRetry: () => void send(lastRequest) })}
        />
      )}

      <ImportHistory state={history.state} onRetry={history.reload} originalUrl={api.originalUrl} />
      {history.state.status === 'ready' ? (
        <SelectionVersions
          api={api}
          pairs={pairs}
          selectedKey={selectedPair}
          onSelect={setSelectedPair}
          refreshToken={refreshToken}
        />
      ) : null}
    </section>
  );
}
