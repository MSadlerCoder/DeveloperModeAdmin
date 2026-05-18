import { useEffect, useState } from 'react';
import type { CreateProjectInput, ProjectRecord } from '../types/project';

const emptyProject: CreateProjectInput = {
  name: '',
  description: '',
  sshHost: '',
  sshPort: 22,
  sshUser: 'ubuntu',
  projectPath: '',
  publicUrl: '',
  engineInstructions: '',
  notes: [],
  conventions: [],
};

type Props = {
  project: ProjectRecord | null;
  onCreate: (input: CreateProjectInput) => Promise<void>;
  onUpdate: (projectId: string, input: CreateProjectInput) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
};

function toLines(values: string[]): string {
  return values.join('\n');
}

function fromLines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function ProjectForm({ project, onCreate, onUpdate, onDelete }: Props) {
  const [form, setForm] = useState<CreateProjectInput>(emptyProject);
  const [notesText, setNotesText] = useState('');
  const [conventionsText, setConventionsText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setForm(project);
      setNotesText(toLines(project.notes));
      setConventionsText(toLines(project.conventions));
    } else {
      setForm(emptyProject);
      setNotesText('');
      setConventionsText('');
    }
  }, [project]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      sshPort: Number(form.sshPort) || 22,
      notes: fromLines(notesText),
      conventions: fromLines(conventionsText),
    };
    try {
      if (project) {
        await onUpdate(project.projectId, payload);
      } else {
        await onCreate(payload);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{project ? 'Edit Project' : 'New Project'}</h2>
        {project && (
          <button type="button" onClick={() => void onDelete(project.projectId)} className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500">
            Delete
          </button>
        )}
      </div>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <input className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Project name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <textarea className="min-h-20 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-[1fr_90px_120px]">
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="SSH host" value={form.sshHost} onChange={(event) => setForm({ ...form, sshHost: event.target.value })} required />
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" type="number" placeholder="Port" value={form.sshPort} onChange={(event) => setForm({ ...form, sshPort: Number(event.target.value) })} />
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="SSH user" value={form.sshUser} onChange={(event) => setForm({ ...form, sshUser: event.target.value })} required />
        </div>
        <input className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Project path on EC2" value={form.projectPath} onChange={(event) => setForm({ ...form, projectPath: event.target.value })} required />
        <input className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Public preview URL" value={form.publicUrl} onChange={(event) => setForm({ ...form, publicUrl: event.target.value })} />
        <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Project-level engine instructions" value={form.engineInstructions} onChange={(event) => setForm({ ...form, engineInstructions: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <textarea className="min-h-20 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Notes, one per line" value={notesText} onChange={(event) => setNotesText(event.target.value)} />
          <textarea className="min-h-20 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" placeholder="Conventions, one per line" value={conventionsText} onChange={(event) => setConventionsText(event.target.value)} />
        </div>
        <button type="submit" disabled={saving} className="w-full rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60">
          {saving ? 'Saving…' : project ? 'Update Project' : 'Create Project'}
        </button>
      </form>
    </section>
  );
}
