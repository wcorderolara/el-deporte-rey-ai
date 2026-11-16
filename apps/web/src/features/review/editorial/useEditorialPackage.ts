import type { EditorialPackage } from '@edr/contracts';
import { useCallback, useEffect, useState } from 'react';

import { useReviewDependencies } from '../ReviewContext';

import { defaultEditorialApi, type EditorialApi } from './api';

export interface EditorialPackageState {
  api: EditorialApi;
  pkg: EditorialPackage | null;
  loadError: unknown;
  /** Reads the package again (after an operation); a failure keeps the shown package. */
  reload: (signal?: AbortSignal) => Promise<void>;
}

/**
 * The editorial package of the project's draft (PD-ARCH-01H, getEditorialPackage), read once the draft is known and
 * again when the draft changes. The review page shares it: the copy workspace acts on it, and the header, the final
 * approval and the downloads only report its state.
 */
export function useEditorialPackage(projectId: string, draftId: string | null): EditorialPackageState {
  const { editorial = defaultEditorialApi } = useReviewDependencies();
  const [pkg, setPkg] = useState<EditorialPackage | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await editorial.getPackage(projectId, signal);
        if (signal?.aborted !== true) {
          setPkg(next);
          setLoadError(null);
        }
      } catch (error) {
        if (signal?.aborted !== true) {
          setLoadError(error);
        }
      }
    },
    [editorial, projectId],
  );

  useEffect(() => {
    if (draftId === null) return;
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload, draftId]);

  return { api: editorial, pkg, loadError, reload };
}
