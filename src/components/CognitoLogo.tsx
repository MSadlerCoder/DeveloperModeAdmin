export function CognitoLogo() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 4h12v3H9v3h7v3H9v4h9v3H6V4Z" fill="currentColor" />
        </svg>
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">OIDC Sign In</div>
        <div className="text-xl font-semibold text-white">AWS Cognito</div>
      </div>
    </div>
  );
}
