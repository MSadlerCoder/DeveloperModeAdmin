export type ProjectType = 'remote_ec2' | 'codex_cloud';

export type CodexProjectConfig = {
  environmentId: string;
};

export type ProjectRecord = {
  projectId: string;
  name: string;
  description: string;
  projectType?: ProjectType;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshPrivateKeySecretName?: string;
  projectPath?: string;
  publicUrl?: string;
  engineInstructions?: string;
  notes?: string[];
  conventions?: string[];
  codex?: CodexProjectConfig;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
};

export type CreateRemoteEc2ProjectInput = {
  projectId?: string;
  name: string;
  description: string;
  projectType?: 'remote_ec2';
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPrivateKeySecretName?: string;
  projectPath: string;
  publicUrl: string;
  engineInstructions: string;
  notes: string[];
  conventions: string[];
};

export type CreateCodexCloudProjectInput = {
  projectId?: string;
  name: string;
  description: string;
  projectType: 'codex_cloud';
  codex: Pick<CodexProjectConfig, 'environmentId'>;
};

export type CreateProjectInput = CreateRemoteEc2ProjectInput | CreateCodexCloudProjectInput;

export type UpdateProjectInput = Partial<CreateRemoteEc2ProjectInput> | {
  name?: string;
  description?: string;
  projectType?: 'codex_cloud';
  codex?: Partial<CodexProjectConfig>;
};

export function getProjectType(project: Pick<ProjectRecord, 'projectType'> | null | undefined): ProjectType {
  return project?.projectType === 'codex_cloud' ? 'codex_cloud' : 'remote_ec2';
}

export function projectTypeLabel(projectType: ProjectType): string {
  return projectType === 'codex_cloud' ? 'Codex Cloud' : 'Remote EC2';
}
