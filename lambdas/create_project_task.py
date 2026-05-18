import json
from shared.defaults import default_limits, default_queue_control, default_status, new_id, now_iso, project_snapshot
from shared.http import response
from shared.project_store import get_project
from shared.task_queueing import append_task_message_and_queue_reply
from shared.task_store import put_project_task


def handler(event, context):
    project_id = event['pathParameters']['projectId']
    project = get_project(project_id)
    payload = json.loads(event.get('body') or '{}')
    timestamp = now_iso()
    goal = payload.get('instructions', {}).get('goal') or payload.get('goal') or ''
    messages = payload.get('conversation', {}).get('messages') or []
    task = {
        'taskId': payload.get('taskId') or new_id('task'),
        'projectId': project_id,
        'title': payload.get('title') or goal[:80] or 'Untitled Task',
        'project': project_snapshot(project),
        'instructions': {
            'goal': goal,
            'notes': payload.get('instructions', {}).get('notes', []),
            'successCriteria': payload.get('instructions', {}).get('successCriteria', []),
        },
        'conversation': {
            'messages': messages,
            'readyForEngine': payload.get('conversation', {}).get('readyForEngine', False),
            'engineSummary': payload.get('conversation', {}).get('engineSummary'),
            'lastMessageId': messages[-1].get('id') if messages else None,
        },
        'engine': payload.get('engine') or {'queuedAt': None, 'startedAt': None, 'completedAt': None, 'lastRunId': None},
        'status': payload.get('status') or default_status(timestamp),
        'progress': payload.get('progress') or {'iteration': 0, 'history': []},
        'limits': {**default_limits(), **payload.get('limits', {})},
        'queueControl': {**default_queue_control(), **payload.get('queueControl', {})},
        'createdAt': timestamp,
        'updatedAt': timestamp,
    }
    try:
        if goal and not messages:
            append_task_message_and_queue_reply(task, project_id, task['taskId'], goal, payload=payload, timestamp=timestamp)
        created = put_project_task(task)
    except RuntimeError as exc:
        return response(500, {'message': str(exc)})

    return response(201, created)
