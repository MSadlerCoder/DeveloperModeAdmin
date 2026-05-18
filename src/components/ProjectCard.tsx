import type { ProjectRecord } from '../types/project';

type Props = {
  project: ProjectRecord;
  onOpen: (projectId: string) => void;
  onEdit: (project: ProjectRecord) => void;
  onDelete: (projectId: string) => Promise<void>;
};

function Detail({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm text-slate-200">{value || '—'}</div>
    </div>
  );
}

export function ProjectCard({ project, onOpen, onEdit, onDelete }: Props) {
  const taskCount = typeof project.taskCount === 'number' ? project.taskCount : undefined;

  return (
    <article className="flex h-full flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{project.name || project.projectId}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{project.description || 'No description provided.'}</p>
          </div>
          {taskCount !== undefined && (
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <Detail label="SSH Host" value={project.sshHost} />
          <Detail label="Project Path" value={project.projectPath} />
          <Detail label="SSH Key Secret" value={project.sshPrivateKeySecretName ? 'configured' : 'not configured'} />
          <Detail label="Public URL" value={project.publicUrl} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpen(project.projectId)} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
          Open Project
        </button>
        <button type="button" onClick={() => onEdit(project)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
          Edit
        </button>
        <button type="button" onClick={() => void onDelete(project.projectId)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-600 hover:text-white">
          Delete
        </button>
      </div>
    </article>
  );
}
