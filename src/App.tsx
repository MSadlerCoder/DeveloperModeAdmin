import { useEffect, useMemo, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { api } from './api';
import { CognitoLogo } from './components/CognitoLogo';
import { TaskDetails } from './components/TaskDetails';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import type { CreateTaskInput, TaskRecord } from './types/task';

function shellCard(children: React.ReactNode) {
  return <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/20 backdrop-blur">{children}</div>;
}

export default function App() {
  const auth = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedTask = useMemo(
    () => tasks.find((task) => task.taskId === selectedTaskId) || null,
    [selectedTaskId, tasks],
  );

  async function loadTasks() {
    setLoading(true);
    setError('');
    try {
      const response = await api.listTasks();
      setTasks(response.tasks);
      if (!selectedTaskId && response.tasks[0]) {
        setSelectedTaskId(response.tasks[0].taskId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.isAuthenticated) {
      void loadTasks();
    }
  }, [auth.isAuthenticated]);

  async function handleCreate(input: CreateTaskInput) {
    await api.createTask(input);
    await loadTasks();
  }

  async function handleUpdate(input: TaskRecord) {
    await api.updateTask(input);
    await loadTasks();
  }

  async function handlePause(taskId: string) {
    await api.patchTaskStatus(taskId, { flag: 'paused' });
    await loadTasks();
  }

  async function handleResume(taskId: string) {
    await api.patchTaskStatus(taskId, { flag: 'running', humanStopRequested: false });
    await loadTasks();
  }

  async function handleStop(taskId: string) {
    await api.patchTaskStatus(taskId, { flag: 'stopped', humanStopRequested: true });
    await loadTasks();
  }

  async function handleDelete(taskId: string) {
    await api.deleteTask(taskId);
    setSelectedTaskId(null);
    await loadTasks();
  }

  if (auth.isLoading) {
    return <div className="min-h-screen bg-slate-950 px-6 py-12">{shellCard(<div className="text-slate-200">Loading authentication…</div>)}</div>;
  }

  if (auth.error) {
    return <div className="min-h-screen bg-slate-950 px-6 py-12">{shellCard(<div className="text-rose-300">Auth error: {auth.error.message}</div>)}</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-12">
        <div className="mx-auto max-w-xl pt-16">
          {shellCard(
            <div className="space-y-6 text-center">
              <div className="flex justify-center"><CognitoLogo /></div>
              <div>
                <h1 className="text-3xl font-semibold text-white">Task Controller Dashboard</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Sign in with AWS Cognito to manage remote build tasks, inspect progress, and update task definitions.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                onClick={() => void auth.signinRedirect()}
              >
                Sign in
              </button>
            </div>,
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-5 shadow-2xl shadow-black/20 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Task Controller Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">React, TypeScript, Tailwind, OIDC, API Gateway, Lambda</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadTasks()} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
              Refresh
            </button>
            <button type="button" onClick={() => void auth.signoutRedirect()} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
              Sign out
            </button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {loading && <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Loading tasks…</div>}

        <main className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <TaskList tasks={tasks} selectedTaskId={selectedTaskId} onSelect={(task) => setSelectedTaskId(task.taskId)} />
            <TaskDetails task={selectedTask} onPause={handlePause} onResume={handleResume} onStop={handleStop} onDelete={handleDelete} />
          </div>
          <div>
            <TaskForm task={selectedTask} onCreate={handleCreate} onUpdate={handleUpdate} />
          </div>
        </main>
      </div>
    </div>
  );
}
