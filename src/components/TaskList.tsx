import type { TaskRecord } from '../types/task';

export function statusClasses(flag: string): string {
  if (['running', 'thinking', 'doing', 'building', 'checking', 'connected', 'indexing', 'continuing', 'engine_running'].includes(flag)) {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30';
  }
  if (['queued', 'starting', 'queued_for_continuation', 'build_failed', 'waiting_for_engine'].includes(flag)) {
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30';
  }
  if (['waiting_for_reply', 'replying'].includes(flag)) {
    return 'bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30';
  }
  if (['complete', 'awaiting_review', 'ready'].includes(flag)) {
    return 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30';
  }
  if (['error', 'stopped'].includes(flag)) {
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30';
  }
  return 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/30';
}

type Props = {
  tasks: TaskRecord[];
  onOpen: (taskId: string) => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (taskId: string) => Promise<void>;
};

export function TaskList({ tasks, onOpen, onEdit, onDelete }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Tasks</h2>
        <span className="text-sm text-slate-400">{tasks.length} total</span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <article key={task.taskId} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-white/20 hover:bg-slate-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-white">{task.title || task.taskId}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(task.status.flag)}`}>{task.status.flag}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{task.status.message || task.instructions.goal || 'No latest status message.'}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>Phase: {task.status.phase || 'idle'}</span>
                  <span>Updated: {task.updatedAt || task.status.updatedAt || task.createdAt || '—'}</span>
                  <span>Iteration: {task.progress?.iteration ?? 0}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" onClick={() => onOpen(task.taskId)} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
                  Open Task
                </button>
                <button type="button" onClick={() => onEdit(task)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                  Edit
                </button>
                <button type="button" onClick={() => void onDelete(task.taskId)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-600 hover:text-white">
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-400">
            No tasks found for this project. Create a task to start a runtime session.
          </div>
        )}
      </div>
    </section>
  );
}
