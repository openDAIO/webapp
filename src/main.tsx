import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import Web3Provider from './services/wallet/Web3Provider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </StrictMode>,
);
