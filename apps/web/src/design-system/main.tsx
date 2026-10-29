import '../ui/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DesignSystemPreview } from './DesignSystemPreview';

const container = document.getElementById('design-system-root');
if (container === null) {
  throw new Error('Missing #design-system-root element');
}

createRoot(container).render(
  <StrictMode>
    <DesignSystemPreview />
  </StrictMode>,
);
