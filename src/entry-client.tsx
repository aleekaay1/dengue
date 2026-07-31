import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import type { InitialDashboardData } from './types/ssr';

const el = document.getElementById('root');
if (!el) {
  throw new Error('#root missing');
}

const initial =
  (typeof window !== 'undefined'
    ? (window.__INITIAL_DATA__ as InitialDashboardData | null | undefined)
    : null) ?? null;

const tree = (
  <StrictMode>
    <App initialData={initial} />
  </StrictMode>
);

if (initial?.zones?.length && el.hasChildNodes()) {
  hydrateRoot(el, tree);
} else {
  createRoot(el).render(tree);
}
