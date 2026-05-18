import json
from shared.defaults import now_iso
from shared.http import response
from shared.project_store import get_project, put_project


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
        'projectPath',
        'publicUrl',
        'engineInstructions',
        'notes',
        'conventions',
    ]:
        if key in payload:
            existing[key] = int(payload[key]) if key == 'sshPort' else payload[key]
    existing['updatedAt'] = now_iso()
    return response(200, put_project(existing))
