import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import App from './App';
import './styles.css';

const requiredOidcEnv = [
  'VITE_OIDC_AUTHORITY',
  'VITE_OIDC_CLIENT_ID',
  'VITE_OIDC_REDIRECT_URI',
  'VITE_OIDC_POST_LOGOUT_REDIRECT_URI',
] as const;

function readRequiredEnv(name: (typeof requiredOidcEnv)[number]): string | null {
  const value = import.meta.env[name];
  return value || null;
}

function MissingConfiguration({ missingVariables }: { missingVariables: readonly string[] }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl pt-16">
        <div className="rounded-3xl border border-amber-400/30 bg-slate-900/85 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">Configuration needed</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Task Controller Dashboard</h1>
          <p className="mt-4 leading-7 text-slate-300">
            The app loaded, but it cannot start sign-in because the deployment is missing required OIDC environment variables.
            Add the variables below to the build environment and redeploy.
          </p>
          <ul className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4 font-mono text-sm text-amber-100">
            {missingVariables.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-400">
            These values are compiled into the Vite bundle at build time, so changing server environment variables requires a new build.
          </p>
        </div>
      </div>
    </div>
  );
}

const oidcValues = Object.fromEntries(requiredOidcEnv.map((name) => [name, readRequiredEnv(name)])) as Record<
  (typeof requiredOidcEnv)[number],
  string | null
>;
const missingVariables = requiredOidcEnv.filter((name) => !oidcValues[name]);

const root = ReactDOM.createRoot(document.getElementById('root')!);

if (missingVariables.length > 0) {
  root.render(
    <React.StrictMode>
      <MissingConfiguration missingVariables={missingVariables} />
    </React.StrictMode>,
  );
} else {
  const oidcConfig = {
    authority: oidcValues.VITE_OIDC_AUTHORITY,
    client_id: oidcValues.VITE_OIDC_CLIENT_ID,
    redirect_uri: oidcValues.VITE_OIDC_REDIRECT_URI,
    post_logout_redirect_uri: oidcValues.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    response_type: 'code',
    scope: import.meta.env.VITE_OIDC_SCOPE || 'openid email profile',
    automaticSilentRenew: false,
  };

  root.render(
    <React.StrictMode>
      <AuthProvider {...oidcConfig}>
        <App />
      </AuthProvider>
    </React.StrictMode>,
  );
}
