import { useState } from 'react';
import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from '../types/project';
import { ProjectCard } from './ProjectCard';
import { ProjectForm } from './ProjectForm';

type Props = {
  projects: ProjectRecord[];
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
  onUpdateProject: (projectId: string, input: UpdateProjectInput) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
};

export function ProjectsPage({ projects, onCreateProject, onUpdateProject, onDeleteProject, onOpenProject }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  function openCreateForm() {
    setEditingProject(null);
    setFormOpen(true);
  }

  function openEditForm(project: ProjectRecord) {
    setEditingProject(project);
    setFormOpen(true);
  }

  async function handleCreate(input: CreateProjectInput) {
    await onCreateProject(input);
    setFormOpen(false);
  }

  async function handleUpdate(projectId: string, input: UpdateProjectInput) {
    await onUpdateProject(projectId, input);
    setEditingProject(null);
    setFormOpen(false);
  }

  async function handleDelete(projectId: string) {
    await onDeleteProject(projectId);
    if (editingProject?.projectId === projectId) {
      setEditingProject(null);
      setFormOpen(false);
    }
  }

  return (
    <main className="space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Manage EC2-connected projects for the autonomous task engine.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
          New Project
        </button>
      </section>

      {formOpen && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,760px)]">
          <ProjectForm project={editingProject} onCreate={handleCreate} onUpdate={handleUpdate} onDelete={handleDelete} onCancel={() => { setFormOpen(false); setEditingProject(null); }} />
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.projectId} project={project} onOpen={onOpenProject} onEdit={openEditForm} onDelete={handleDelete} />
        ))}
        {projects.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/60 px-6 py-16 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
            No projects yet. Create a project to connect an EC2 workspace to the autonomous task engine.
          </div>
        )}
      </section>
    </main>
  );
}
