import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

// Global error handler for SES and WebContainer errors
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('SES_UNCAUGHT_EXCEPTION')) {
    console.warn('SES error suppressed - WebContainer not supported in this environment');
    event.preventDefault(); // Prevent the error from propagating
    return false;
  }
});

// Handle unhandled promise rejections that might contain SES errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && String(event.reason).includes('SES')) {
    console.warn('SES promise rejection suppressed - WebContainer not supported');
    event.preventDefault();
    return false;
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)