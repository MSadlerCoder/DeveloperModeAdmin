import type { TaskRecord } from '../types/task';

type Props = {
  task: TaskRecord | null;
  onPause: (taskId: string) => Promise<void>;
  onResume: (taskId: string) => Promise<void>;
  onStop: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
};

function actionButtonClass(color: 'slate' | 'amber' | 'rose' | 'emerald') {
  const map = {
    slate: 'bg-slate-800 text-white hover:bg-slate-700',
    amber: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
    rose: 'bg-rose-600 text-white hover:bg-rose-500',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-500',
  };
  return `rounded-2xl px-4 py-2 text-sm font-medium transition ${map[color]}`;
}

export function TaskDetails({ task, onPause, onResume, onStop, onDelete }: Props) {
  if (!task) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-400">
          Select a task to view details.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{task.taskId}</h2>
          <p className="mt-1 text-sm text-slate-400">{task.project.publicUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={actionButtonClass('slate')} onClick={() => onPause(task.taskId)}>Pause</button>
          <button type="button" className={actionButtonClass('emerald')} onClick={() => onResume(task.taskId)}>Resume</button>
          <button type="button" className={actionButtonClass('amber')} onClick={() => onStop(task.taskId)}>Stop</button>
          <button type="button" className={actionButtonClass('rose')} onClick={() => onDelete(task.taskId)}>Delete</button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Status', task.status.flag],
          ['Phase', task.status.phase || 'idle'],
          ['Updated', task.status.updatedAt || '—'],
          ['Iteration', String(task.progress.iteration)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 text-sm text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Last Message</div>
        <p className="mt-2 text-sm text-slate-200">{task.status.message || '—'}</p>
        {task.status.lastError && <p className="mt-3 text-sm text-rose-300">{task.status.lastError}</p>}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">History</h3>
        <div className="mt-3 space-y-3">
          {task.progress.history.slice().reverse().map((item, index) => (
            <div key={`${item.ts}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="text-xs text-slate-500">{item.ts} · {item.kind}</div>
              {item.summary && <div className="mt-2 text-sm text-slate-100">{item.summary}</div>}
              {item.error && <div className="mt-2 text-sm text-rose-300">{item.error}</div>}
              {item.result && (
                <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950 p-3 text-xs text-slate-200">{JSON.stringify(item.result, null, 2)}</pre>
              )}
            </div>
          ))}
          {task.progress.history.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400">
              No history yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
