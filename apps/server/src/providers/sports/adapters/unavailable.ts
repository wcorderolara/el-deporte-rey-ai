/**
 * Placeholder adapter for a registered kind whose implementation is not delivered yet (T21 stubs replaced by T49 and
 * T50). It declares its kind and mode, and an enabled source using it stops startup with "adapter not available"
 * (OD-20). Its methods are never reached after a successful startup; they fail with `unavailable` if called.
 */
import { ConfigError } from '../../../platform/config/index.js';
import {
  type AdapterContext,
  type AdapterRegistration,
  type DataMode,
  type IngestionSource,
  SourceError,
} from '../ingestion/index.js';

/** Problem text of the startup error of an adapter that is not available. */
export const ADAPTER_NOT_AVAILABLE = 'adapter not available';

export function unavailableAdapter(kind: string, mode: DataMode): AdapterRegistration {
  return Object.freeze({
    kind,
    mode,
    create({ descriptor, setting }: AdapterContext): IngestionSource {
      const refuse = (): Promise<never> =>
        Promise.reject(new SourceError('unavailable', ADAPTER_NOT_AVAILABLE, descriptor.id));
      return Object.freeze({
        descriptor,
        listCompetitions: refuse,
        listSeasons: refuse,
        listStages: refuse,
        fetchSelection: refuse,
        validateStartup(): void {
          throw new ConfigError(`${setting}.adapter`, ADAPTER_NOT_AVAILABLE);
        },
      });
    },
  });
}
