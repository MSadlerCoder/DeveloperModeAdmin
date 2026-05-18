import type { ProjectRecord } from '../types/project';
import type { SendTaskMessageInput, TaskRecord } from '../types/task';
import { ProjectPreviewFrame } from './ProjectPreviewFrame';
import { TaskChat } from './TaskChat';
import { statusClasses } from './TaskList';

type Props = {
  project: ProjectRecord;
  task: TaskRecord;
  isActive: boolean;
  onBackToProject: () => void;
  onBackToProjects: () => void;
  onSendMessage: (input: SendTaskMessageInput) => Promise<void>;
};

export function TaskRuntimePage({ project, task, isActive, onBackToProject, onBackToProjects, onSendMessage }: Props) {
  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <button type="button" onClick={onBackToProjects} className="transition hover:text-white">Projects</button>
          <span>›</span>
          <button type="button" onClick={onBackToProject} className="transition hover:text-white">{project.name || project.projectId}</button>
          <span>›</span>
          <span className="text-slate-200">{task.title || task.taskId}</span>
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button type="button" onClick={onBackToProject} className="mb-4 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
              ← Back to Project Tasks
            </button>
            <h1 className="text-3xl font-semibold text-white">{task.title || task.taskId}</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{task.status.message || task.instructions.goal}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(task.status.flag)}`}>{task.status.flag}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">{task.status.phase || 'idle'}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">Iteration {task.progress?.iteration ?? 0}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(380px,0.95fr)_minmax(560px,1.05fr)]">
        <TaskChat task={task} isActive={isActive} onSend={onSendMessage} />
        <ProjectPreviewFrame project={project} />
      </section>
    </main>
  );
}
