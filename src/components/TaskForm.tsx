import { useEffect, useMemo, useState } from 'react';
import type { CreateTaskInput, TaskLimits, TaskRecord } from '../types/task';

const defaultLimits: TaskLimits = {
  maxStepsPerRun: 8,
  maxBuildsPerRun: 3,
  maxInstallsPerRun: 2,
  maxFilesWrittenPerRun: 12,
  maxFileSizeBytes: 120000,
  maxTotalNewDependencies: 4,
};

type Props = {
  task?: TaskRecord | null;
  onCreate: (input: CreateTaskInput) => Promise<void>;
  onUpdate: (input: TaskRecord) => Promise<void>;
};

type FormState = {
  taskId: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  projectPath: string;
  publicUrl: string;
  goal: string;
  notes: string;
  successCriteria: string;
  limits: TaskLimits;
};

function toLines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function fromTask(task?: TaskRecord | null): FormState {
  if (!task) {
    return {
      taskId: '',
      sshHost: '',
      sshPort: 22,
      sshUser: 'ubuntu',
      projectPath: '',
      publicUrl: '',
      goal: '',
      notes: '',
      successCriteria: '',
      limits: defaultLimits,
    };
  }

  return {
    taskId: task.taskId,
    sshHost: task.project.sshHost,
    sshPort: task.project.sshPort,
    sshUser: task.project.sshUser,
    projectPath: task.project.projectPath,
    publicUrl: task.project.publicUrl,
    goal: task.instructions.goal,
    notes: task.instructions.notes.join('\n'),
    successCriteria: task.instructions.successCriteria.join('\n'),
    limits: task.limits,
  };
}

function inputClassName() {
  return 'mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-500/60 focus:ring-4 focus:ring-amber-500/10';
}

export function TaskForm({ task, onCreate, onUpdate }: Props) {
  const isEditing = Boolean(task);
  const baseState = useMemo(() => fromTask(task), [task]);
  const [form, setForm] = useState<FormState>(baseState);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(baseState);
  }, [baseState]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        taskId: form.taskId,
        project: {
          sshHost: form.sshHost,
          sshPort: Number(form.sshPort),
          sshUser: form.sshUser,
          projectPath: form.projectPath,
          publicUrl: form.publicUrl,
        },
        instructions: {
          goal: form.goal,
          notes: toLines(form.notes),
          successCriteria: toLines(form.successCriteria),
        },
        status: task?.status || {
          flag: 'idle',
          phase: 'idle',
          message: '',
          updatedAt: '',
          lastError: '',
          isComplete: false,
          humanStopRequested: false,
        },
        progress: task?.progress || {
          iteration: 0,
          history: [],
        },
        limits: {
          ...form.limits,
          maxStepsPerRun: Number(form.limits.maxStepsPerRun),
          maxBuildsPerRun: Number(form.limits.maxBuildsPerRun),
          maxInstallsPerRun: Number(form.limits.maxInstallsPerRun),
          maxFilesWrittenPerRun: Number(form.limits.maxFilesWrittenPerRun),
          maxFileSizeBytes: Number(form.limits.maxFileSizeBytes),
          maxTotalNewDependencies: Number(form.limits.maxTotalNewDependencies),
        },
      };

      if (isEditing && task) {
        await onUpdate(payload);
      } else {
        await onCreate(payload);
        setForm(fromTask(null));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{isEditing ? 'Update Task' : 'Create Task'}</h2>
          <p className="mt-1 text-sm text-slate-400">Edit the `task.json` fields used by the remote builder.</p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-200">
            Task ID
            <input className={inputClassName()} value={form.taskId} disabled={isEditing} required onChange={(e) => setField('taskId', e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-200">
            SSH Host
            <input className={inputClassName()} value={form.sshHost} required onChange={(e) => setField('sshHost', e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-200">
            SSH Port
            <input className={inputClassName()} type="number" value={form.sshPort} required onChange={(e) => setField('sshPort', Number(e.target.value))} />
          </label>
          <label className="text-sm font-medium text-slate-200">
            SSH User
            <input className={inputClassName()} value={form.sshUser} required onChange={(e) => setField('sshUser', e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-200 md:col-span-2">
            Project Path
            <input className={inputClassName()} value={form.projectPath} required onChange={(e) => setField('projectPath', e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-200 md:col-span-2">
            Public URL
            <input className={inputClassName()} value={form.publicUrl} required onChange={(e) => setField('publicUrl', e.target.value)} />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-200">
          Goal
          <textarea className={`${inputClassName()} min-h-24`} value={form.goal} required onChange={(e) => setField('goal', e.target.value)} />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-200">
            Notes (one per line)
            <textarea className={`${inputClassName()} min-h-32`} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Success Criteria (one per line)
            <textarea className={`${inputClassName()} min-h-32`} value={form.successCriteria} onChange={(e) => setField('successCriteria', e.target.value)} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['maxStepsPerRun', 'Max Steps'],
            ['maxBuildsPerRun', 'Max Builds'],
            ['maxInstallsPerRun', 'Max Installs'],
            ['maxFilesWrittenPerRun', 'Max Files Written'],
            ['maxFileSizeBytes', 'Max File Size'],
            ['maxTotalNewDependencies', 'Max New Dependencies'],
          ].map(([key, label]) => (
            <label className="text-sm font-medium text-slate-200" key={key}>
              {label}
              <input
                className={inputClassName()}
                type="number"
                value={form.limits[key as keyof TaskLimits]}
                onChange={(e) =>
                  setField('limits', {
                    ...form.limits,
                    [key]: Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving…' : isEditing ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </section>
  );
}
