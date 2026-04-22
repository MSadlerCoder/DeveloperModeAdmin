import type { TaskRecord } from '../types/task';

function statusClasses(flag: TaskRecord['status']['flag']): string {
  switch (flag) {
    case 'running':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30';
    case 'paused':
      return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30';
    case 'complete':
      return 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30';
    case 'stopped':
      return 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/30';
  }
}

type Props = {
  tasks: TaskRecord[];
  selectedTaskId: string | null;
  onSelect: (task: TaskRecord) => void;
};

export function TaskList({ tasks, selectedTaskId, onSelect }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Current Tasks</h2>
        <span className="text-sm text-slate-400">{tasks.length} total</span>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <button
            key={task.taskId}
            type="button"
            onClick={() => onSelect(task)}
            className={[
              'w-full rounded-2xl border p-4 text-left transition',
              selectedTaskId === task.taskId
                ? 'border-amber-500/70 bg-slate-800 shadow-lg shadow-amber-500/10'
                : 'border-white/10 bg-slate-950/60 hover:border-white/20 hover:bg-slate-900',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-white">{task.taskId}</div>
                <div className="mt-1 text-sm text-slate-300">{task.instructions.goal}</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(task.status.flag)}`}>
                {task.status.flag}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>{task.project.projectPath}</span>
              <span>Iteration {task.progress.iteration}</span>
              <span>{task.status.phase || 'idle'}</span>
            </div>
          </button>
        ))}

        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-400">
            No tasks found.
          </div>
        )}
      </div>
    </section>
  );
}
