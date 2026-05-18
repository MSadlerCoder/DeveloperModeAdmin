import json
from shared.defaults import now_iso
from shared.http import response
from shared.project_store import get_project
from shared.task_chat import ensure_task_shape
from shared.task_queueing import append_task_message_and_queue_reply
from shared.task_store import get_project_task, put_project_task


def handler(event, context):
    params = event['pathParameters']
    project_id = params['projectId']
    task_id = params['taskId']
    payload = json.loads(event.get('body') or '{}')
    content = (payload.get('content') or payload.get('message') or '').strip()
    if not content:
        return response(400, {'message': 'Message content is required.'})

    # Load both records so callers get an immediate failure for missing project/task.
    get_project(project_id)
    task = ensure_task_shape(get_project_task(project_id, task_id))
    timestamp = now_iso()
    try:
        append_task_message_and_queue_reply(task, project_id, task_id, content, payload=payload, timestamp=timestamp)
        put_project_task(task)
    except RuntimeError as exc:
        return response(500, {'message': str(exc)})

    return response(200, task)
