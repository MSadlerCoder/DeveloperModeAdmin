# DeveloperModeAdmin contributor rules

## Architecture
- Preserve separate `remote_ec2` and `codex_cloud` execution paths.
- Do not combine the two project types into one ambiguous execution flow.
- The frontend never selects queues or runner infrastructure.
- Backend Lambda handlers route work by project type.
- Missing `projectType` means `remote_ec2` for backward compatibility.

## Task state
- Preserve nested `task.status.flag`; never replace the status object with a string.
- S3 task JSON is authoritative.
- SQS messages are pointers to task JSON and must not contain full prompts.
- Codex prompts live in S3 at `tasks/<projectId>/<taskId>/codex-prompt.txt`.
- `runnerJobId` and `codexTaskId` are different concepts: the first is the local CLI-runner lookup key, the second is the external Codex Cloud task identifier.

## Security
- The frontend must never receive credentials.
- Do not expose SSH private keys, AWS credentials, queue URLs, Codex tokens, or Codex CLI credentials.
- Do not log full Codex prompts.
- Keep infrastructure defaults server-side.
- Sanitize external links with `target="_blank"` and `rel="noreferrer noopener"`.

## Compatibility
- Old remote EC2 records remain valid.
- Preserve existing endpoints.
- Preserve current planning chat behavior unless intentionally changed.
- Preserve existing remote EC2 task UI and queueing behavior.

## Testing
- Add tests for routing, project types, prompt S3 writes, nested status shape, frontend polling, and UI rendering when touching those areas.
- Run backend tests and frontend build before reporting completion.
- Do not use real AWS or Codex Cloud in tests.
