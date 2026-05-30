import { useState } from 'react';
import { getProjectType, projectTypeLabel, type ProjectRecord } from '../types/project';
import type { CreateTaskInput, TaskRecord } from '../types/task';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';

type Props = {
  project: ProjectRecord;
  tasks: TaskRecord[];
  onBackToProjects: () => void;
  onCreateTask: (input: CreateTaskInput) => Promise<void>;
  onUpdateTask: (taskId: string, input: CreateTaskInput) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onOpenTask: (taskId: string) => void;
};

function SummaryItem({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm text-slate-200">{value || '—'}</div>
    </div>
  );
}

function summarize(value: string): string {
  if (!value) return '—';
  return value.length > 280 ? `${value.slice(0, 280).trim()}…` : value;
}

export function ProjectTasksPage({ project, tasks, onBackToProjects, onCreateTask, onUpdateTask, onDeleteTask, onOpenTask }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const projectType = getProjectType(project);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);

  function openCreateForm() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEditForm(task: TaskRecord) {
    setEditingTask(task);
    setFormOpen(true);
  }

  async function handleCreate(input: CreateTaskInput) {
    await onCreateTask(input);
    setFormOpen(false);
  }

  async function handleUpdate(taskId: string, input: CreateTaskInput) {
    await onUpdateTask(taskId, input);
    setEditingTask(null);
    setFormOpen(false);
  }

  return (
    <main className="space-y-6">
      <button type="button" onClick={onBackToProjects} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
        ← Projects
      </button>

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">{project.name || project.projectId}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{project.description || 'No description provided.'}</p>
          </div>
          {projectType === 'remote_ec2' && project.publicUrl && (
            <a href={project.publicUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
              Open public URL ↗
            </a>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryItem label="Project Type" value={projectTypeLabel(projectType)} />
          {projectType === 'codex_cloud' ? (
            <>
              <SummaryItem label="Codex Environment ID" value={project.codex?.environmentId} />
              <SummaryItem label="Default Attempts" value={project.codex?.defaultAttempts} />
              <SummaryItem label="Poll Delay Seconds" value={project.codex?.pollDelaySeconds} />
              <SummaryItem label="Post-completion Action" value={project.codex?.postCompletionAction} />
            </>
          ) : (
            <>
              <SummaryItem label="SSH Host" value={project.sshHost} />
              <SummaryItem label="SSH User" value={project.sshUser} />
              <SummaryItem label="SSH Port" value={project.sshPort} />
              <SummaryItem label="Project Path" value={project.projectPath} />
              <SummaryItem label="SSH Key Secret" value={project.sshPrivateKeySecretName ? 'configured' : 'not configured'} />
              <SummaryItem label="Public URL" value={project.publicUrl} />
              <SummaryItem label="Engine Instructions" value={summarize(project.engineInstructions || '')} />
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Project Tasks</h2>
          <p className="mt-1 text-sm text-slate-400">Create, review, and open runtime sessions for this project.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
          New Task
        </button>
      </section>

      {formOpen && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,760px)]">
          <TaskForm task={editingTask} projectType={projectType} disabled={false} onCreate={handleCreate} onUpdate={handleUpdate} onCancel={() => { setFormOpen(false); setEditingTask(null); }} />
        </div>
      )}

      <TaskList tasks={tasks} onOpen={onOpenTask} onEdit={openEditForm} onDelete={onDeleteTask} />
    </main>
  );
}
