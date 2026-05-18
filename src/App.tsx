import { useEffect, useMemo, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { api } from './api';
import { CognitoLogo } from './components/CognitoLogo';
import { ProjectForm } from './components/ProjectForm';
import { ProjectSidebar } from './components/ProjectSidebar';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { TaskPage } from './components/TaskPage';
import type { CreateProjectInput, ProjectRecord } from './types/project';
import type { CreateTaskInput, SendTaskMessageInput, TaskRecord } from './types/task';
import { isTaskActive } from './types/task';

function shellCard(children: React.ReactNode) {
  return <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/20 backdrop-blur">{children}</div>;
}

export default function App() {
  const auth = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === selectedProjectId) || null,
    [projects, selectedProjectId],
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.taskId === selectedTaskId) || null,
    [selectedTaskId, tasks],
  );
  const selectedTaskIsActive = isTaskActive(selectedTask);

  async function loadProjects() {
    setError('');
    const response = await api.listProjects();
    setProjects(response.projects);
    if (!selectedProjectId && response.projects[0]) {
      setSelectedProjectId(response.projects[0].projectId);
    }
  }

  async function loadTasks(projectId: string) {
    setError('');
    const response = await api.listProjectTasks(projectId);
    setTasks(response.tasks);
    if (!selectedTaskId || !response.tasks.some((task) => task.taskId === selectedTaskId)) {
      setSelectedTaskId(response.tasks[0]?.taskId || null);
    }
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await loadProjects();
      if (selectedProjectId) {
        await loadTasks(selectedProjectId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.isAuthenticated) {
      setLoading(true);
      void loadProjects()
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
        .finally(() => setLoading(false));
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (selectedProjectId) {
      setLoading(true);
      setSelectedTaskId(null);
      void loadTasks(selectedProjectId)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tasks'))
        .finally(() => setLoading(false));
    } else {
      setTasks([]);
      setSelectedTaskId(null);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedTaskId || !selectedTaskIsActive) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void api.getProjectTask(selectedProjectId, selectedTaskId).then((freshTask) => {
        setTasks((current) => current.map((task) => (task.taskId === freshTask.taskId ? freshTask : task)));
      }).catch((err) => setError(err instanceof Error ? err.message : 'Polling failed'));
    }, 3500);

    return () => window.clearInterval(timer);
  }, [selectedProjectId, selectedTaskId, selectedTaskIsActive]);

  async function handleCreateProject(input: CreateProjectInput) {
    const project = await api.createProject(input);
    await loadProjects();
    setSelectedProjectId(project.projectId);
  }

  async function handleUpdateProject(projectId: string, input: CreateProjectInput) {
    const project = await api.updateProject(projectId, input);
    setProjects((current) => current.map((item) => (item.projectId === project.projectId ? project : item)));
  }

  async function handleDeleteProject(projectId: string) {
    await api.deleteProject(projectId);
    setSelectedProjectId(null);
    setSelectedTaskId(null);
    await loadProjects();
  }

  async function handleCreateTask(input: CreateTaskInput) {
    if (!selectedProjectId) {
      return;
    }
    const task = await api.createProjectTask(selectedProjectId, input);
    await loadTasks(selectedProjectId);
    setSelectedTaskId(task.taskId);
  }

  async function handleUpdateTask(taskId: string, input: CreateTaskInput) {
    if (!selectedProjectId) {
      return;
    }
    const task = await api.updateProjectTask(selectedProjectId, taskId, input);
    setTasks((current) => current.map((item) => (item.taskId === task.taskId ? task : item)));
  }

  async function handleDeleteTask(taskId: string) {
    if (!selectedProjectId) {
      return;
    }
    await api.deleteProjectTask(selectedProjectId, taskId);
    setSelectedTaskId(null);
    await loadTasks(selectedProjectId);
  }

  async function handleSendMessage(input: SendTaskMessageInput) {
    if (!selectedProjectId || !selectedTaskId) {
      return;
    }
    const task = await api.sendTaskMessage(selectedProjectId, selectedTaskId, input);
    setTasks((current) => current.map((item) => (item.taskId === task.taskId ? task : item)));
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
                <h1 className="text-3xl font-semibold text-white">Project + Task Controller Dashboard</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Sign in with AWS Cognito to manage project context, queue autonomous coding tasks, and review live engine progress.
                </p>
              </div>
              <button type="button" className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400" onClick={() => void auth.signinRedirect()}>
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
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-5 shadow-2xl shadow-black/20 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Project + Task Controller Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Queue SQS-backed autonomous engine runs and watch the live project preview.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void refreshAll()} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">Refresh</button>
            <button type="button" onClick={() => void auth.signoutRedirect()} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Sign out</button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {loading && <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Loading dashboard…</div>}

        <main className="grid gap-6 xl:grid-cols-[320px_minmax(380px,460px)_minmax(0,1fr)]">
          <div className="space-y-6">
            <ProjectSidebar projects={projects} selectedProjectId={selectedProjectId} onSelect={setSelectedProjectId} />
            <ProjectForm project={selectedProject} onCreate={handleCreateProject} onUpdate={handleUpdateProject} onDelete={handleDeleteProject} />
          </div>

          <div className="space-y-6">
            {selectedProject ? (
              <>
                <TaskList tasks={tasks} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} onDelete={handleDeleteTask} />
                <TaskForm task={selectedTask} disabled={selectedTaskIsActive} onCreate={handleCreateTask} onUpdate={handleUpdateTask} />
              </>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-300 shadow-2xl shadow-black/20 backdrop-blur">Create or select a project before creating tasks.</div>
            )}
          </div>

          <TaskPage project={selectedProject} task={selectedTask} isActive={selectedTaskIsActive} onSendMessage={handleSendMessage} />
        </main>
      </div>
    </div>
  );
}
