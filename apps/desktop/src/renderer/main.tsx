import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/index.css';
import { bindAppearance } from './shared/appearance/store';
import { App } from './app/App';
import { installNotesFlush } from './features/tasks';

bindAppearance();
// The main process calls window.__ordoFlushNotes() before closing a window (pending note saves).
installNotesFlush();

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
