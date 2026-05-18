import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { api } from './api';
import { CognitoLogo } from './components/CognitoLogo';
import { ProjectTasksPage } from './components/ProjectTasksPage';
import { ProjectsPage } from './components/ProjectsPage';
import { TaskRuntimePage } from './components/TaskRuntimePage';
import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from './types/project';
import type { CreateTaskInput, SendTaskMessageInput, TaskRecord, UpdateTaskInput } from './types/task';
import { isTaskActive } from './types/task';

type AppView = 'projects' | 'project' | 'task';

function shellCard(children: ReactNode) {
  return <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/20 backdrop-blur">{children}</div>;
}

export default function App() {
  const auth = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectDetails, setProjectDetails] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('projects');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedProject = useMemo(() => {
    if (projectDetails?.projectId === selectedProjectId) {
      return projectDetails;
    }
    return projects.find((project) => project.projectId === selectedProjectId) || null;
  }, [projectDetails, projects, selectedProjectId]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.taskId === selectedTaskId) || null,
    [selectedTaskId, tasks],
  );
  const selectedTaskIsActive = isTaskActive(selectedTask);

  async function loadProjects() {
    setError('');
    const response = await api.listProjects();
    setProjects(response.projects);
  }

  async function loadProject(projectId: string) {
    setError('');
    const project = await api.getProject(projectId);
    setProjectDetails(project);
    setProjects((current) => current.map((item) => (item.projectId === project.projectId ? project : item)));
    return project;
  }

  async function loadTasks(projectId: string) {
    setError('');
    const response = await api.listProjectTasks(projectId);
    setTasks(response.tasks);
    return response.tasks;
  }

  async function refreshCurrentView() {
    setLoading(true);
    try {
      if (currentView === 'projects' || !selectedProjectId) {
        await loadProjects();
        return;
      }

      await Promise.all([loadProject(selectedProjectId), loadTasks(selectedProjectId)]);
      if (currentView === 'task' && selectedTaskId) {
        const freshTask = await api.getProjectTask(selectedProjectId, selectedTaskId);
        setTasks((current) => current.map((task) => (task.taskId === freshTask.taskId ? freshTask : task)));
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
    if (!auth.isAuthenticated || currentView === 'projects' || !selectedProjectId) {
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all([loadProject(selectedProjectId), loadTasks(selectedProjectId)])
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load project');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, currentView, selectedProjectId]);

  useEffect(() => {
    if (!auth.isAuthenticated || currentView !== 'task' || !selectedProjectId || !selectedTaskId) {
      return undefined;
    }

    let cancelled = false;
    void api.getProjectTask(selectedProjectId, selectedTaskId)
      .then((freshTask) => {
        if (!cancelled) {
          setTasks((current) => {
            const exists = current.some((task) => task.taskId === freshTask.taskId);
            return exists ? current.map((task) => (task.taskId === freshTask.taskId ? freshTask : task)) : [freshTask, ...current];
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load task');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, currentView, selectedProjectId, selectedTaskId]);

  useEffect(() => {
    if (currentView !== 'task' || !selectedProjectId || !selectedTaskId || !selectedTaskIsActive) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void api.getProjectTask(selectedProjectId, selectedTaskId)
        .then((freshTask) => {
          setTasks((current) => current.map((task) => (task.taskId === freshTask.taskId ? freshTask : task)));
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Polling failed'));
    }, 3500);

    return () => window.clearInterval(timer);
  }, [currentView, selectedProjectId, selectedTaskId, selectedTaskIsActive]);

  function handleBackToProjects() {
    setCurrentView('projects');
    setSelectedProjectId(null);
    setSelectedTaskId(null);
    setProjectDetails(null);
    setTasks([]);
  }

  function handleOpenProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedTaskId(null);
    setCurrentView('project');
  }

  function handleBackToProject() {
    if (selectedProjectId) {
      setSelectedTaskId(null);
      setCurrentView('project');
    } else {
      handleBackToProjects();
    }
  }

  function handleOpenTask(taskId: string) {
    setSelectedTaskId(taskId);
    setCurrentView('task');
  }

  async function handleCreateProject(input: CreateProjectInput) {
    const project = await api.createProject(input);
    await loadProjects();
    setProjectDetails(project);
    setSelectedProjectId(project.projectId);
    setSelectedTaskId(null);
    setCurrentView('project');
  }

  async function handleUpdateProject(projectId: string, input: UpdateProjectInput) {
    const project = await api.updateProject(projectId, input);
    setProjects((current) => current.map((item) => (item.projectId === project.projectId ? project : item)));
    if (project.projectId === selectedProjectId) {
      setProjectDetails(project);
    }
  }

  async function handleDeleteProject(projectId: string) {
    await api.deleteProject(projectId);
    if (projectId === selectedProjectId) {
      handleBackToProjects();
    }
    await loadProjects();
  }

  async function handleCreateTask(input: CreateTaskInput) {
    if (!selectedProjectId) {
      return;
    }
    const task = await api.createProjectTask(selectedProjectId, input);
    const freshTasks = await loadTasks(selectedProjectId);
    if (!freshTasks.some((item) => item.taskId === task.taskId)) {
      setTasks((current) => [task, ...current]);
    }
    setSelectedTaskId(task.taskId);
    setCurrentView('task');
  }

  async function handleUpdateTask(taskId: string, input: UpdateTaskInput) {
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
    if (taskId === selectedTaskId) {
      setSelectedTaskId(null);
      setCurrentView('project');
    }
    await loadTasks(selectedProjectId);
  }

  async function handleSendMessage(input: SendTaskMessageInput) {
    if (!selectedProjectId || !selectedTaskId) {
      return;
    }
    const task = await api.sendTaskMessage(selectedProjectId, selectedTaskId, input);
    setTasks((current) => current.map((item) => (item.taskId === task.taskId ? task : item)));
  }

  async function handlePromoteTask() {
    if (!selectedProjectId || !selectedTaskId) {
      return;
    }
    const response = await api.promoteProjectTask(selectedProjectId, selectedTaskId);
    setTasks((current) => current.map((item) => (item.taskId === response.task.taskId ? response.task : item)));
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
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-300">Autonomous Engine Control</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Project + Task Controller Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void refreshCurrentView()} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">Refresh</button>
            <button type="button" onClick={() => void auth.signoutRedirect()} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Sign out</button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {loading && <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Loading…</div>}

        {currentView === 'projects' && (
          <ProjectsPage projects={projects} onCreateProject={handleCreateProject} onUpdateProject={handleUpdateProject} onDeleteProject={handleDeleteProject} onOpenProject={handleOpenProject} />
        )}

        {currentView === 'project' && selectedProject && (
          <ProjectTasksPage project={selectedProject} tasks={tasks} onBackToProjects={handleBackToProjects} onCreateTask={handleCreateTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onOpenTask={handleOpenTask} />
        )}

        {currentView === 'task' && selectedProject && selectedTask && (
          <TaskRuntimePage project={selectedProject} task={selectedTask} isActive={selectedTaskIsActive} onBackToProject={handleBackToProject} onBackToProjects={handleBackToProjects} onSendMessage={handleSendMessage} onPromoteTask={handlePromoteTask} />
        )}

        {currentView !== 'projects' && !selectedProject && !loading && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-sm text-slate-300 shadow-2xl shadow-black/20 backdrop-blur">
            The selected project could not be found. <button type="button" onClick={handleBackToProjects} className="text-amber-300 hover:text-amber-200">Return to Projects.</button>
          </div>
        )}
      </div>
    </div>
  );
}
