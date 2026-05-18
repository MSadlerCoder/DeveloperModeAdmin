import json
from shared.defaults import now_iso
from shared.http import response
from shared.project_store import get_project, put_project


def optional_string(value):
    if value is None:
        return ''
    return str(value).strip()


def handler(event, context):
    project_id = event['pathParameters']['projectId']
    existing = get_project(project_id)
    payload = json.loads(event.get('body') or '{}')
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
