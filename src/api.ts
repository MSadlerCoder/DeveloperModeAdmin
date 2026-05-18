import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from './types/project';
import type { CreateTaskInput, SendTaskMessageInput, TaskRecord, UpdateTaskInput } from './types/task';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getIdToken(): string | null {
  const storages = [localStorage, sessionStorage];

  for (const storage of storages) {
    const keys = Object.keys(storage).filter((key) => key.startsWith('oidc.user:'));

    for (const key of keys) {
      try {
        const parsed = JSON.parse(storage.getItem(key) || '{}') as {
          id_token?: string;
          access_token?: string;
        };

        if (parsed.id_token) {
          return parsed.id_token;
        }
      } catch {
        // ignore malformed values
      }
    }
  }

  return null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_BASE_URL');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');

  const idToken = getIdToken();
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  } else {
    console.warn('No Cognito ID token found in localStorage or sessionStorage');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

const encode = encodeURIComponent;

export const api = {
  listProjects: (): Promise<{ projects: ProjectRecord[] }> => request('/projects'),

  getProject: (projectId: string): Promise<ProjectRecord> => request(`/projects/${encode(projectId)}`),

  createProject: (input: CreateProjectInput): Promise<ProjectRecord> =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateProject: (projectId: string, input: UpdateProjectInput): Promise<ProjectRecord> =>
    request(`/projects/${encode(projectId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteProject: (projectId: string): Promise<void> =>
    request(`/projects/${encode(projectId)}`, {
      method: 'DELETE',
    }),

  listProjectTasks: (projectId: string): Promise<{ tasks: TaskRecord[] }> =>
    request(`/projects/${encode(projectId)}/tasks`),

  getProjectTask: (projectId: string, taskId: string): Promise<TaskRecord> =>
    request(`/projects/${encode(projectId)}/tasks/${encode(taskId)}`),

  createProjectTask: (projectId: string, input: CreateTaskInput): Promise<TaskRecord> =>
    request(`/projects/${encode(projectId)}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateProjectTask: (projectId: string, taskId: string, input: UpdateTaskInput): Promise<TaskRecord> =>
    request(`/projects/${encode(projectId)}/tasks/${encode(taskId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteProjectTask: (projectId: string, taskId: string): Promise<void> =>
    request(`/projects/${encode(projectId)}/tasks/${encode(taskId)}`, {
      method: 'DELETE',
    }),

  sendTaskMessage: (projectId: string, taskId: string, input: SendTaskMessageInput): Promise<TaskRecord> =>
    request(`/projects/${encode(projectId)}/tasks/${encode(taskId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  promoteProjectTask: (projectId: string, taskId: string): Promise<{ ok: true; task: TaskRecord }> =>
    request(`/projects/${encode(projectId)}/tasks/${encode(taskId)}/promote`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
