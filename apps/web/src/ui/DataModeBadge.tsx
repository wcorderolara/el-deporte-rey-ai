import type { DataMode } from '../api/types';
import { dataModeLabel } from './copy';
import { StatusBadge, type BadgeTone } from './StatusBadge';

const tone: Record<DataMode, BadgeTone> = {
  LIVE_DATA: 'info',
  MANUAL_DATA: 'neutral',
  DEMO_DATA: 'demo',
};

export interface DataModeBadgeProps {
  mode: DataMode;
}

/** Data acquisition mode of a project, source or fact (PD-13, R-269). */
export function DataModeBadge({ mode }: DataModeBadgeProps) {
  return <StatusBadge label={dataModeLabel[mode]} tone={tone[mode]} />;
}
