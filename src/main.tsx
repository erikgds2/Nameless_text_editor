// Cascadia Mono e Segoe UI vêm do Windows; a IBM Plex Mono fica empacotada
// como reserva para quando o app rodar fora dele.
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Captura from './components/Captura';
import './styles.css';

// A janelinha da captura rápida é o mesmo app, aberto noutro modo — assim ela
// herda tema, tokens e a camada de arquivos sem duplicar nada.
const modo = new URLSearchParams(window.location.search).get('modo');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{modo === 'captura' ? <Captura /> : <App />}</StrictMode>,
);
