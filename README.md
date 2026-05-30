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

## Lambda deployment architecture

This repository now supports a TradeboxAPI-style Lambda zip deployment flow adapted to the existing dashboard layout:

- Lambda source remains in the existing `lambdas/` root instead of being moved to a new `lambda/` directory.
- Because the current repo has a flat Lambda layout, `deploy_config.json` maps those handlers into one deployable module named `task_controller` with AWS function names like `task_controller_list_tasks`.
- `lambdas/lambda_env` is the deployment environment file. `[shared]` applies to every handler, and handler-specific sections such as `[list_tasks]` override shared values.
- `lambdas/lambda_permissions.json` defines the execution-role managed policies and inline IAM statements for the module.
- `lambdas/api-routes.json` maps HTTP API routes to Lambda handlers.
- `scripts/deploy_lambdas.py` packages each selected handler into `build/lambdas/{module}/{function}.zip`, creates or updates the module IAM role, updates Lambda code/configuration, publishes an immutable version, and moves the configured alias such as `dev`.
- `scripts/deploy_api_routes.py` creates or updates API Gateway v2 HTTP API integrations/routes and points integrations at Lambda aliases through the stage variable `lambdaAlias`.
- `.github/workflows/deploy-dev-lambdas.yml` deploys on pushes to `main` that touch Lambda deployment files and can also be run manually. It uses GitHub OIDC via `aws-actions/configure-aws-credentials@v4`.

### Required GitHub Actions secrets and variables

Secrets required for the development deployment workflow:

- `AWS_REGION` - AWS region for Lambda, IAM, SQS, and API Gateway operations.
- `AWS_ACCOUNT_ID` - AWS account that owns the Lambda functions and HTTP API.
- `AWS_DEPLOY_ROLE_ARN` - IAM role assumed by GitHub Actions through OIDC.
- `API_GATEWAY_ID` - Existing API Gateway v2 HTTP API id.
- `API_DEFAULT_AUTHORIZER_ID` - Default JWT authorizer id used by routes with `auth: true`.
- `TASK_BUCKET` - S3 bucket used by the task CRUD Lambdas.

Variables:

- `CORS_ORIGIN` - CORS origin passed to Lambda environments. Defaults to `http://localhost:5173` in the workflow if unset.

### Deploy role permissions

The GitHub OIDC deploy role needs permissions for these AWS API families:

- IAM role management for the per-module Lambda execution role: `iam:GetRole`, `iam:CreateRole`, `iam:UpdateAssumeRolePolicy`, `iam:PutRolePolicy`, `iam:AttachRolePolicy`, and `iam:PassRole` scoped to `DeveloperModeAdminLambdaRole-*`.
- Lambda deployment: `lambda:GetFunction`, `lambda:CreateFunction`, `lambda:UpdateFunctionCode`, `lambda:UpdateFunctionConfiguration`, `lambda:PublishVersion`, `lambda:GetAlias`, `lambda:CreateAlias`, `lambda:UpdateAlias`, `lambda:AddPermission`, `lambda:ListEventSourceMappings`, `lambda:CreateEventSourceMapping`, and `lambda:UpdateEventSourceMapping` scoped to `task_controller_*` functions.
- API Gateway v2 route deployment: `apigateway:GET`, `apigateway:POST`, `apigateway:PATCH`, and `apigateway:PUT` on the HTTP API and its stages/routes/integrations.
- SQS lookup and trigger setup when `deploy_sqs_triggers` is enabled: `sqs:GetQueueUrl` and `sqs:GetQueueAttributes` for referenced queues.
- Task chat uses a lightweight `DeveloperModeTaskMessageQueue` event source for planning replies, while full task execution continues to use the existing engine task queue. Create the message queue before enabling SQS trigger deployment.
- STS identity lookup: `sts:GetCallerIdentity`.

### Deployment scope examples

Edit `deploy_config.json` to control scope before running deployment.

Deploy all configured functions in the existing flat module:

```json
{
  "active_modules": ["task_controller"],
  "functions": { "task_controller": "*" },
  "deploy_lambdas": true,
  "deploy_api_routes": true,
  "deploy_sqs_triggers": false
}
```

Deploy one function only:

```json
{
  "active_modules": ["task_controller"],
  "functions": { "task_controller": ["list_tasks"] },
  "deploy_lambdas": true,
  "deploy_api_routes": true,
  "deploy_sqs_triggers": false
}
```

Lambda-only deployment:

```json
{
  "deploy_lambdas": true,
  "deploy_api_routes": false,
  "deploy_sqs_triggers": false
}
```

API-only deployment:

```json
{
  "deploy_lambdas": false,
  "deploy_api_routes": true,
  "deploy_sqs_triggers": false
}
```

SQS-trigger-only mode after functions already exist:

```json
{
  "deploy_lambdas": false,
  "deploy_api_routes": false,
  "deploy_sqs_triggers": true
}
```

No-SQS mode is the default: keep `deploy_sqs_triggers` set to `false`.

### Manual deployment commands

Set the required environment variables locally, then run:

```bash
python -m pip install boto3 botocore
python scripts/deploy_lambdas.py --deploy-config deploy_config.json
python scripts/deploy_api_routes.py --deploy-config deploy_config.json --stage dev --lambda-alias dev
```

### Task chat engine progress fields

The task chat screen treats `task.json` as the live source of truth while the engine worker runs. It polls the project task endpoint while a task has an active engine flag/phase, then renders a distinct engine progress panel from these fields:

- `task.status.flag` — identifies queued, active, and terminal states such as `engine_running`, `complete`, `error`, `awaiting_review`, and `stopped`.
- `task.status.phase` — shows the current engine phase, including `starting`, `connected`, `indexing`, `thinking`, `doing`, `building`, `build_failed`, `deploy_failed`, `deploying`, `deployed`, `checking`, and `continuing`.
- `task.status.message` — provides the current human-readable engine update.
- `task.status.lastError` — displays a terminal or in-progress engine error without dumping raw logs.
- `task.status.updatedAt` — labels when the latest task status was written.
- `task.progress.iteration` — shows the current engine iteration when present.
- `task.progress.history[]` — contributes the latest concise progress entries, including thinking summaries, action results, build/deploy results, completion checks, incomplete/complete run messages, and errors. Long or sensitive-looking output is truncated/redacted before display.

## Project types and execution paths

DeveloperModeAdmin supports two project types:

- `remote_ec2` — the existing autonomous EC2 workflow. Missing `projectType` values are treated as `remote_ec2` for backward compatibility.
- `codex_cloud` — a review-oriented Codex Cloud workflow routed through Codex submission and polling workers in the separate `DeveloperModeWorkers` repository.

The execution paths stay separate:

```text
remote_ec2   -> TASK_QUEUE_URL       -> autonomous EC2 engine worker -> SSH/SFTP -> build -> deploy
codex_cloud  -> CODEX_TASK_QUEUE_URL -> Codex submit worker          -> runner EC2 -> Codex Cloud -> poll worker -> S3 task.json updates
```

The frontend never selects queues and never receives runner host/user/key data, AWS credentials, Codex CLI credentials, or Codex tokens. The backend routes by `projectType`.

## Frontend API routes

The React API client continues to use the existing project-scoped routes:

```text
GET    /projects
GET    /projects/{projectId}
POST   /projects
PUT    /projects/{projectId}
DELETE /projects/{projectId}

GET    /projects/{projectId}/tasks
GET    /projects/{projectId}/tasks/{taskId}
POST   /projects/{projectId}/tasks
PUT    /projects/{projectId}/tasks/{taskId}
DELETE /projects/{projectId}/tasks/{taskId}

POST   /projects/{projectId}/tasks/{taskId}/messages
POST   /projects/{projectId}/tasks/{taskId}/promote
```

No route accepts a frontend-selected SQS queue.

## Codex Cloud project creation

Ordinary frontend Codex Cloud creation payloads are intentionally narrow:

```json
{
  "name": "Example project",
  "description": "Optional description",
  "projectType": "codex_cloud",
  "codex": {
    "environmentId": "env_example"
  }
}
```

The API Lambda requires and stores only the non-secret `codex.environmentId` for Codex Cloud projects. Runner hosts, runner paths, SSH private-key secrets, retry defaults, polling delay, post-completion actions, direct runner access, and Codex CLI credentials are not Task Controller configuration; SSH, runner submission, polling, retries, and completion handling are owned by the separate `DeveloperModeWorkers` repository.

## Codex worker handoff configuration

This Task Controller repo requires only one Codex-specific environment variable for handoff to the workers repo:

```text
CODEX_TASK_QUEUE_URL=[CODEX_TASK_QUEUE_URL]
```

## Codex prompts and queue messages

When a Codex Cloud task is promoted or explicitly queued with `/run`, `/queue`, or `/start`, the API Lambda composes a prompt from the task title, goal, notes, success criteria, relevant planning conversation, and project-level safe instructions. The prompt is written to S3 at:

```text
tasks/<projectId>/<taskId>/codex-prompt.txt
```

The authoritative task JSON stores `task.codex.promptS3Key`. The SQS message sent to `CODEX_TASK_QUEUE_URL` is a pointer only:

```json
{
  "taskBucket": "<task bucket>",
  "taskKey": "tasks/<projectId>/<taskId>.json",
  "projectId": "<projectId>",
  "taskId": "<taskId>"
}
```

Do not put full prompts or secrets in SQS messages or logs.

## Nested task status model

Task status remains a nested object. Handlers must use `task.status.flag` and must never replace `task.status` with a string.

Codex lifecycle flags include:

```text
queued
submitting_to_codex
waiting_for_codex
codex_running
codex_completed
codex_failed
completed
failed
```

The initial API queueing status for Codex Cloud is:

```json
{
  "flag": "queued",
  "phase": "codex_queued",
  "message": "Task queued for Codex Cloud.",
  "updatedAt": "<timestamp>",
  "isComplete": false
}
```

## Codex task metadata

Codex-specific task data lives under `task.codex`, for example:

```json
{
  "promptS3Key": "tasks/<projectId>/<taskId>/codex-prompt.txt",
  "taskType": "investigation",
  "environmentId": "env_example",
  "runnerJobId": "<local-runner-job-id>",
  "codexTaskId": "<external-codex-cloud-task-id>",
  "codexTaskUrl": "https://...",
  "submissionStatus": "submitted",
  "submittedAt": "...",
  "lastCheckedAt": "...",
  "completedAt": "...",
  "summary": "...",
  "error": "..."
}
```

`runnerJobId` is the local CLI-runner lookup key. `codexTaskId` is the external Codex Cloud task identifier.

## Polling cadence and completion meaning

Codex polling is owned by the separate `DeveloperModeWorkers` repository. The React app independently polls this API roughly every 3.5 seconds while active task flags are present so it can display worker-written S3 task status updates.

`codex_completed` means Codex Cloud has completed and produced something to review. It does **not** mean this dashboard merged, pulled, built, deployed, published, or made changes live.

## Lambda environment variables for Codex Cloud

Add these values to `lambdas/lambda_env` before deployment:

```text
CODEX_TASK_QUEUE_URL=[CODEX_TASK_QUEUE_URL]
```

Do not commit real queue URLs or tokens unless the repository intentionally uses placeholder substitution for them. This repo does not require Codex Runner host placeholders or SSH private-key secret placeholders.

## IAM and manual AWS resources

The API Lambda execution role needs:

- Existing S3 write access under `tasks/*` to store Codex prompt text and task JSON.
- `sqs:SendMessage` to the Codex submission queue referenced by `CODEX_TASK_QUEUE_URL`.

This API repository should not add permissions for Codex polling queue consumption, SSH access, Secrets Manager runner-key reads, or Codex CLI credentials. Those belong to `DeveloperModeWorkers`.

Before deployment, manually create or confirm:

- The Codex submission SQS queue and its ARN.
- The Codex worker deployment and its own IAM permissions, including any SSH, Secrets Manager, polling, retry, and runner-submission configuration it needs.
- Any Codex Cloud environment IDs referenced by projects.

## Validation commands

Recommended checks before deployment:

```bash
python -m pytest tests/test_codex_cloud.py
python -m py_compile $(find lambdas -name '*.py' -print)
npm run build
python -m json.tool deploy_config.json >/dev/null
python -m json.tool lambdas/lambda_permissions.json >/dev/null
```

Run deployment preflight scripts only when you intend to inspect deployment readiness. Do not deploy unless explicitly requested.
