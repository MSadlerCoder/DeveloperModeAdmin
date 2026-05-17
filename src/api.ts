import type { CreateTaskInput, TaskRecord, UpdateTaskInput } from './types/task';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getIdToken(): string | null {
  const keys = Object.keys(localStorage).filter((key) =>
    key.startsWith('oidc.user:')
  );

  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}') as {
        id_token?: string;
      };

      if (parsed.id_token) {
        return parsed.id_token;
      }
    } catch {
      // ignore malformed values
    }
  }

  return null;
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_BASE_URL');
  }

  const headers = new Headers(init.headers || {});

  headers.set('Content-Type', 'application/json');

  const idToken = getIdToken();

  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  } else {
    console.warn('No Cognito ID token found');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();

    console.error('API request failed', {
      status: response.status,
      body: text,
    });

    throw new Error(text || `API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listTasks: (): Promise<{ tasks: TaskRecord[] }> =>
    request('/tasks'),

  getTask: (taskId: string): Promise<TaskRecord> =>
    request(`/tasks/${encodeURIComponent(taskId)}`),

  createTask: (input: CreateTaskInput): Promise<TaskRecord> =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateTask: (input: UpdateTaskInput): Promise<TaskRecord> =>
    request(`/tasks/${encodeURIComponent(input.taskId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  patchTaskStatus: (
    taskId: string,
    status: Partial<TaskRecord['status']>
  ): Promise<TaskRecord> =>
    request(`/tasks/${encodeURIComponent(taskId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteTask: (taskId: string): Promise<void> =>
    request(`/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    }),
};