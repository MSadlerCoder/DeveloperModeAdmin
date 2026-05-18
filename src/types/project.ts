export type ProjectRecord = {
  projectId: string;
  name: string;
  description: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPrivateKeySecretName?: string;
  projectPath: string;
  publicUrl: string;
  engineInstructions: string;
  notes: string[];
  conventions: string[];
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
};

export type CreateProjectInput = Omit<ProjectRecord, 'projectId' | 'createdAt' | 'updatedAt' | 'taskCount'> & {
  projectId?: string;
};

export type UpdateProjectInput = Partial<Omit<ProjectRecord, 'projectId' | 'createdAt' | 'updatedAt' | 'taskCount'>>;
