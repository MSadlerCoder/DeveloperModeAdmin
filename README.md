# Task Controller Dashboard

This is a React + TypeScript + Vite dashboard for managing task records used by the remote Lambda build agent.

## What changed in this version

- Tailwind CSS setup using the Vite plugin
- Tailwind utility-based component styling across the UI
- root `lambda.env` file in bracket-section format matching the Lambda filenames
- Python Lambda CRUD handlers in `/lambdas`

## Front-end stack

- React
- TypeScript
- Vite
- Tailwind CSS
- `react-oidc-context`

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Build with:

```bash
npm run build
```

## Environment variables for the front end

```bash
VITE_API_BASE_URL=https://your-api-id.execute-api.your-region.amazonaws.com/prod
VITE_OIDC_AUTHORITY=https://your-cognito-domain.auth.your-region.amazoncognito.com
VITE_OIDC_CLIENT_ID=your-client-id
VITE_OIDC_REDIRECT_URI=http://localhost:5173
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_OIDC_SCOPE=openid email profile
```

## Lambda env file

The root `lambda.env` file follows the same bracketed section style as your uploaded example. Each section name matches the Lambda filename in `/lambdas`, plus a shared section.

Example sections:

- `[shared]`
- `[list_tasks]`
- `[get_task]`
- `[create_task]`
- `[update_task]`
- `[patch_task_status]`
- `[delete_task]`

## API endpoints expected by `src/api.ts`

### `GET /tasks`
Returns:

```json
{ "tasks": [] }
```

### `GET /tasks/{taskId}`
Returns one task record.

### `POST /tasks`
Creates a new task.

### `PUT /tasks/{taskId}`
Updates an existing task.

### `PATCH /tasks/{taskId}/status`
Updates only the task status.

Example body:

```json
{
  "status": {
    "flag": "paused",
    "humanStopRequested": true
  }
}
```

### `DELETE /tasks/{taskId}`
Deletes the task record.

## Lambda handlers

- `lambdas/list_tasks.py`
- `lambdas/get_task.py`
- `lambdas/create_task.py`
- `lambdas/update_task.py`
- `lambdas/patch_task_status.py`
- `lambdas/delete_task.py`

## Storage model

Each task is stored in S3 as:

```text
tasks/{taskId}.json
```

## Lambda environment variables

At minimum, each Lambda needs:

```bash
TASK_BUCKET=your-task-bucket
TASK_PREFIX=tasks/
```
# DeveloperModeAdmin
