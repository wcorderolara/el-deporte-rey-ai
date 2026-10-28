/**
 * FootballDataProvider (LIVE_DATA; contracts/provider-ports.md section 1.4). Stub created by T21: it declares the
 * adapter kind and mode only, and an enabled source using it stops startup with "adapter not available". T49
 * replaces this directory with the adapter.
 */
import { unavailableAdapter } from '../unavailable.js';

export const FOOTBALL_DATA_ADAPTER_KIND = 'football-data';

export const footballDataAdapter = unavailableAdapter(FOOTBALL_DATA_ADAPTER_KIND, 'LIVE_DATA');
