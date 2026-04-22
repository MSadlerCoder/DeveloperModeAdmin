import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import App from './App';
import './styles.css';

function required(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const oidcConfig = {
  authority: required('VITE_OIDC_AUTHORITY'),
  client_id: required('VITE_OIDC_CLIENT_ID'),
  redirect_uri: required('VITE_OIDC_REDIRECT_URI'),
  post_logout_redirect_uri: required('VITE_OIDC_POST_LOGOUT_REDIRECT_URI'),
  response_type: 'code',
  scope: import.meta.env.VITE_OIDC_SCOPE || 'openid email profile',
  automaticSilentRenew: false,
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
