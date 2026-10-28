/**
 * ManualDataProvider (MANUAL_DATA; contracts/provider-ports.md section 1.6). Stub created by T21: it declares the
 * adapter kind and mode only, and an enabled source using it stops startup with "adapter not available". T50
 * replaces this directory with the adapter.
 */
import { unavailableAdapter } from '../unavailable.js';

export const MANUAL_ADAPTER_KIND = 'manual';

export const manualAdapter = unavailableAdapter(MANUAL_ADAPTER_KIND, 'MANUAL_DATA');
