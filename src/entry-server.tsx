import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import type { InitialDashboardData } from './types/ssr';

export function render(initialData: InitialDashboardData | null): {
  html: string;
} {
  const html = renderToString(
    <StrictMode>
      <App initialData={initialData} />
    </StrictMode>
  );
  return { html };
}
