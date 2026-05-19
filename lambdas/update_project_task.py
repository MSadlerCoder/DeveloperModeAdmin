import json
from shared.defaults import default_limits, default_queue_control, now_iso
from shared.http import response
from shared.project_store import get_project
from shared.task_store import get_project_task, put_project_task
from shared.defaults import project_snapshot


def handler(event, context):
    params = event['pathParameters']
    project_id = params['projectId']
    existing = get_project_task(project_id, params['taskId'])
    payload = json.loads(event.get('body') or '{}')
    project = get_project(project_id)
    existing['project'] = project_snapshot(project)
    if 'title' in payload:
        existing['title'] = payload['title']
    if 'instructions' in payload:
        existing['instructions'] = {
            **existing.get('instructions', {}),
            **payload['instructions'],
        }
    if 'conversation' in payload:
        existing['conversation'] = {
            **existing.get('conversation', {}),
            **payload['conversation'],
        }
    if 'status' in payload:
        existing['status'] = {
            **existing.get('status', {}),
            **payload['status'],
        }
    if 'progress' in payload:
        existing['progress'] = {
            **existing.get('progress', {}),
            **payload['progress'],
        }
    if 'limits' in payload:
        existing['limits'] = {**default_limits(), **payload['limits']}
    if 'queueControl' in payload:
        existing['queueControl'] = {**default_queue_control(), **payload['queueControl']}
    existing['updatedAt'] = now_iso()
    return response(200, put_project_task(existing))
