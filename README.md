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
