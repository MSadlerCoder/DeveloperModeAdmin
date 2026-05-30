import json
from shared.defaults import now_iso
from shared.http import response
from shared.project_store import get_project, put_project
from shared.project_types import CODEX_CLOUD, REMOTE_EC2, get_project_type


def optional_string(value):
    if value is None:
        return ''
    return str(value).strip()


def handler(event, context):
    project_id = event['pathParameters']['projectId']
    existing = get_project(project_id)
    payload = json.loads(event.get('body') or '{}')
    try:
        project_type = get_project_type(existing)
        if 'projectType' in payload and get_project_type(payload) != project_type:
            return response(400, {'message': 'Changing projectType is not supported.'})
    except ValueError as exc:
        return response(400, {'message': str(exc)})

    if project_type == CODEX_CLOUD:
        for key in ['name', 'description']:
            if key in payload:
                existing[key] = payload[key]
        codex_payload = payload.get('codex') or {}
        if codex_payload:
            codex = existing.setdefault('codex', {})
            if 'environmentId' in codex_payload:
                environment_id = optional_string(codex_payload.get('environmentId'))
                if not environment_id:
                    return response(400, {'message': 'codex.environmentId is required for codex_cloud projects.'})
                codex['environmentId'] = environment_id
            for key in ['defaultAttempts', 'pollDelaySeconds']:
                if key in codex_payload:
                    codex[key] = int(codex_payload[key])
            if 'postCompletionAction' in codex_payload:
                codex['postCompletionAction'] = optional_string(codex_payload.get('postCompletionAction')) or 'notify_only'
    else:
        existing['projectType'] = REMOTE_EC2
        for key in [
            'name',
            'description',
            'sshHost',
            'sshPort',
            'sshUser',
            'sshPrivateKeySecretName',
            'projectPath',
            'publicUrl',
            'engineInstructions',
            'notes',
            'conventions',
        ]:
            if key in payload:
                if key == 'sshPort':
                    existing[key] = int(payload[key])
                elif key == 'sshPrivateKeySecretName':
                    existing[key] = optional_string(payload[key])
                else:
                    existing[key] = payload[key]
        existing['sshPrivateKeySecretName'] = optional_string(existing.get('sshPrivateKeySecretName'))
    existing['updatedAt'] = now_iso()
    return response(200, put_project(existing))
