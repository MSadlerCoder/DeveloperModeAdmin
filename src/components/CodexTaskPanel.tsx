import type { TaskRecord } from '../types/task';
import { statusClasses } from './TaskList';

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm text-slate-200">{value || '—'}</div>
    </div>
  );
}

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function CodexTaskPanel({ task }: { task: TaskRecord }) {
  const codex = task.codex || {};
  const flag = task.status?.flag || 'queued';
  const isComplete = flag === 'codex_completed';
  const isFailed = flag === 'codex_failed';
  const isActive = ['queued', 'submitting_to_codex', 'waiting_for_codex', 'codex_running'].includes(flag);

  return (
    <section className="rounded-3xl border border-sky-400/20 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Codex Cloud Task</h2>
          <p className="mt-1 text-sm text-slate-400">Review-oriented Codex Cloud execution state. Completion here does not mean deployed.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(flag)}`}>{flag}</span>
      </div>

      {isComplete && (
        <div className="mt-4 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm leading-6 text-emerald-100">
          Codex Cloud completed the task. Review the result before taking further action. This dashboard has not merged, pulled, built, deployed, or published these changes.
        </div>
      )}
      {isFailed && (
        <div className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/15 px-4 py-3 text-sm leading-6 text-rose-100">
          Codex Cloud reported a failure. {codex.error || task.status?.lastError || task.status?.message || 'No error details were provided.'}
        </div>
      )}
      {isActive && (
        <div className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-sky-100">
          Waiting for Codex Cloud updates. The backend poll worker updates task.json independently from this dashboard polling cadence.
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Row label="Status" value={task.status?.message || flag} />
        <Row label="Submission status" value={codex.submissionStatus} />
        <Row label="Environment ID" value={codex.environmentId} />
        <Row label="Attempts" value={codex.attempts} />
        <Row label="Submitted at" value={formatTimestamp(codex.submittedAt)} />
        <Row label="Last checked at" value={formatTimestamp(codex.lastCheckedAt)} />
        <Row label="Completed at" value={formatTimestamp(codex.completedAt)} />
        <Row label="Runner job ID" value={codex.runnerJobId} />
        <Row label="Codex task ID" value={codex.codexTaskId} />
      </div>

      {codex.summary && <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-200"><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Summary</div>{codex.summary}</div>}
      {codex.error && !isFailed && <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100"><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-100/70">Error details</div>{codex.error}</div>}
      {codex.codexTaskUrl && <a href={codex.codexTaskUrl} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex rounded-2xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">Review in Codex Cloud ↗</a>}
    </section>
  );
}
