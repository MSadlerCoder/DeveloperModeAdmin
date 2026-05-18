import type { TaskRecord } from '../types/task';

function statusClasses(flag: string): string {
  if (['running', 'thinking', 'doing', 'building', 'checking', 'connected', 'indexing', 'continuing'].includes(flag)) {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30';
  }
  if (['queued', 'starting', 'queued_for_continuation', 'build_failed'].includes(flag)) {
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30';
  }
  if (['complete', 'awaiting_review'].includes(flag)) {
    return 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30';
  }
  if (['error', 'stopped'].includes(flag)) {
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30';
  }
  return 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/30';
}

type Props = {
  tasks: TaskRecord[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  onDelete: (taskId: string) => Promise<void>;
};

export function TaskList({ tasks, selectedTaskId, onSelect, onDelete }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Project Tasks</h2>
        <span className="text-sm text-slate-400">{tasks.length} total</span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.taskId} className={['rounded-2xl border p-4 transition', selectedTaskId === task.taskId ? 'border-amber-500/70 bg-slate-800' : 'border-white/10 bg-slate-950/60'].join(' ')}>
            <button type="button" onClick={() => onSelect(task.taskId)} className="w-full text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-white">{task.title || task.taskId}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-slate-300">{task.instructions.goal}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(task.status.flag)}`}>{task.status.flag}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>Iteration {task.progress.iteration}</span>
                <span>{task.status.phase || 'idle'}</span>
                <span>{task.updatedAt || task.createdAt}</span>
              </div>
            </button>
            <button type="button" onClick={() => void onDelete(task.taskId)} className="mt-3 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-600 hover:text-white">
              Delete task
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-400">
            No tasks found for this project.
          </div>
        )}
      </div>
    </section>
  );
}
