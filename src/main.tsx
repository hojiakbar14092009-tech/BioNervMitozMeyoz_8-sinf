import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/experience.css';
import './styles/viewer.css';
import App from './App';
import { startPwa } from './features/pwa/pwa';
import { toast } from './lib/toast';

// before the first render, so the browser's one-time install event is not missed
startPwa(() => toast('Internet qayta ulandi'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
