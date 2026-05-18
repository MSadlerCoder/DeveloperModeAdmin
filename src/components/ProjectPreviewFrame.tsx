import type { ProjectRecord } from '../types/project';

export function ProjectPreviewFrame({ project }: { project: ProjectRecord | null }) {
  return (
    <section className="flex min-h-[72vh] flex-col rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Live Project Preview</h2>
            <p className="mt-1 break-all text-sm text-slate-400">{project?.publicUrl || 'No public preview URL configured for this project.'}</p>
          </div>
          {project?.publicUrl && (
            <a href={project.publicUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
              Open ↗
            </a>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-b-3xl bg-slate-950">
        {project?.publicUrl ? (
          <iframe title={`${project.name} preview`} src={project.publicUrl} className="h-full min-h-[640px] w-full border-0 bg-white" />
        ) : (
          <div className="flex h-full min-h-[640px] items-center justify-center px-6 text-center text-sm text-slate-400">No public preview URL configured for this project.</div>
        )}
      </div>
    </section>
  );
}
