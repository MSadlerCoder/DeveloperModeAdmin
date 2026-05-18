import { useEffect, useState } from 'react';
import { DEFAULT_LIMITS, type CreateTaskInput, type TaskLimits, type TaskRecord } from '../types/task';

type Props = {
  task: TaskRecord | null;
  disabled: boolean;
  onCreate: (input: CreateTaskInput) => Promise<void>;
  onUpdate: (taskId: string, input: CreateTaskInput) => Promise<void>;
  onCancel?: () => void;
};

function fromLines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function toLines(values: string[]): string {
  return values.join('\n');
}

export function TaskForm({ task, disabled, onCreate, onUpdate, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [limits, setLimits] = useState<TaskLimits>(DEFAULT_LIMITS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setGoal(task.instructions.goal);
      setNotes(toLines(task.instructions.notes));
      setSuccessCriteria(toLines(task.instructions.successCriteria));
      setLimits({ ...DEFAULT_LIMITS, ...task.limits });
    } else {
      setTitle('');
      setGoal('');
      setNotes('');
      setSuccessCriteria('');
      setLimits(DEFAULT_LIMITS);
    }
  }, [task]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      title,
      instructions: {
        goal,
        notes: fromLines(notes),
        successCriteria: fromLines(successCriteria),
      },
      limits,
    };
    try {
      if (task) {
        await onUpdate(task.taskId, payload);
      } else {
        await onCreate(payload);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{task ? 'Edit Task' : 'New Task'}</h2>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
            Cancel
          </button>
        )}
      </div>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <input className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={disabled} required />
        <textarea className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Current goal / task instructions" value={goal} onChange={(event) => setGoal(event.target.value)} disabled={disabled} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <textarea className="min-h-20 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Task notes, one per line" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={disabled} />
          <textarea className="min-h-20 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Success criteria, one per line" value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} disabled={disabled} />
        </div>
        <details className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer font-medium text-white">Safety limits</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(Object.keys(DEFAULT_LIMITS) as Array<keyof TaskLimits>).map((key) => (
              <label key={key} className="text-xs text-slate-400">
                {key}
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500" type="number" value={limits[key]} onChange={(event) => setLimits({ ...limits, [key]: Number(event.target.value) })} disabled={disabled} />
              </label>
            ))}
          </div>
        </details>
        <button type="submit" disabled={saving || disabled} className="w-full rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? 'Saving…' : task ? 'Update Task' : 'Create Task'}
        </button>
      </form>
    </section>
  );
}
