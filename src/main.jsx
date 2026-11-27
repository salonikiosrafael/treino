import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { requestPersistence, getSetting } from './db.js';
import { applyTheme } from './theme.js';
import './styles.css';

getSetting('theme', 'system').then(applyTheme);
requestPersistence();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
