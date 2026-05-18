import type { ProjectRecord } from '../types/project';

export function ProjectPreviewFrame({ project }: { project: ProjectRecord | null }) {
  return (
    <section className="flex min-h-[620px] flex-col rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="border-b border-white/10 p-5">
        <h2 className="text-lg font-semibold text-white">Live Project Preview</h2>
        <p className="mt-1 truncate text-sm text-slate-400">{project?.publicUrl || 'No public URL configured.'}</p>
      </div>
      <div className="flex-1 overflow-hidden rounded-b-3xl bg-slate-950">
        {project?.publicUrl ? (
          <iframe title={`${project.name} preview`} src={project.publicUrl} className="h-full min-h-[560px] w-full border-0 bg-white" />
        ) : (
          <div className="flex h-full min-h-[560px] items-center justify-center px-6 text-center text-sm text-slate-400">Set a project public URL to preview the running EC2-hosted frontend.</div>
        )}
      </div>
    </section>
  );
}
