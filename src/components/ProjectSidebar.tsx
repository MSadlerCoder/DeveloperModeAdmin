import type { ProjectRecord } from '../types/project';

type Props = {
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
};

export function ProjectSidebar({ projects, selectedProjectId, onSelect }: Props) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Projects</h2>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">{projects.length}</span>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <button
            key={project.projectId}
            type="button"
            onClick={() => onSelect(project.projectId)}
            className={[
              'w-full rounded-2xl border p-3 text-left transition',
              selectedProjectId === project.projectId
                ? 'border-amber-500/70 bg-slate-800 shadow-lg shadow-amber-500/10'
                : 'border-white/10 bg-slate-950/60 hover:border-white/20 hover:bg-slate-900',
            ].join(' ')}
          >
            <div className="font-semibold text-white">{project.name || project.projectId}</div>
            <div className="mt-1 truncate text-xs text-slate-400">{project.projectPath || project.publicUrl}</div>
          </button>
        ))}
        {projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-3 py-8 text-center text-sm text-slate-400">
            Create a project to start controlling engine tasks.
          </div>
        )}
      </div>
    </aside>
  );
}
