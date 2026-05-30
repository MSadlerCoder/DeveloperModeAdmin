import json
from shared.defaults import new_id, now_iso
from shared.http import response
from shared.project_store import put_project
from shared.project_types import CODEX_CLOUD, REMOTE_EC2, get_project_type


def optional_string(value, default=''):
    if value is None:
        return default
    return str(value).strip()


def codex_project_config(payload):
    codex = payload.get('codex') or {}
    environment_id = optional_string(codex.get('environmentId'))
    if not environment_id:
        raise ValueError('codex.environmentId is required for codex_cloud projects.')
    return {
        'environmentId': environment_id,
    }


def remote_project(payload, timestamp):
    return {
        'projectId': payload.get('projectId') or new_id('project'),
        'name': payload.get('name', 'Untitled Project'),
        'description': payload.get('description', ''),
        'projectType': REMOTE_EC2,
        'sshHost': payload.get('sshHost', ''),
        'sshPort': int(payload.get('sshPort') or 22),
        'sshUser': payload.get('sshUser', 'ubuntu'),
        'sshPrivateKeySecretName': optional_string(payload.get('sshPrivateKeySecretName')),
        'projectPath': payload.get('projectPath', ''),
        'publicUrl': payload.get('publicUrl', ''),
        'engineInstructions': payload.get('engineInstructions', ''),
        'notes': payload.get('notes', []),
        'conventions': payload.get('conventions', []),
        'createdAt': timestamp,
        'updatedAt': timestamp,
    }


def handler(event, context):
    payload = json.loads(event.get('body') or '{}')
    timestamp = now_iso()
    try:
        project_type = get_project_type(payload)
        if project_type == CODEX_CLOUD:
            project = {
                'projectId': payload.get('projectId') or new_id('project'),
                'name': payload.get('name', 'Untitled Project'),
                'description': payload.get('description', ''),
                'projectType': CODEX_CLOUD,
                'codex': codex_project_config(payload),
                'createdAt': timestamp,
                'updatedAt': timestamp,
            }
        else:
            project = remote_project(payload, timestamp)
    except ValueError as exc:
        return response(400, {'message': str(exc)})
    return response(201, put_project(project))
