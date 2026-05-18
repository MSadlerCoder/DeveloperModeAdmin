import json
from shared.defaults import new_id, now_iso
from shared.http import response
from shared.project_store import put_project


def handler(event, context):
    payload = json.loads(event.get('body') or '{}')
    timestamp = now_iso()
    project = {
        'projectId': payload.get('projectId') or new_id('project'),
        'name': payload.get('name', 'Untitled Project'),
        'description': payload.get('description', ''),
        'sshHost': payload.get('sshHost', ''),
        'sshPort': int(payload.get('sshPort') or 22),
        'sshUser': payload.get('sshUser', 'ubuntu'),
        'projectPath': payload.get('projectPath', ''),
        'publicUrl': payload.get('publicUrl', ''),
        'engineInstructions': payload.get('engineInstructions', ''),
        'notes': payload.get('notes', []),
        'conventions': payload.get('conventions', []),
        'createdAt': timestamp,
        'updatedAt': timestamp,
    }
    return response(201, put_project(project))
