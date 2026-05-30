from shared.defaults import now_iso
from shared.http import response
from shared.project_store import get_project
from shared.project_types import is_codex_cloud_project
from shared.task_chat import ensure_conversation, ensure_engine, ensure_task_shape, set_status
from shared.task_queueing import engine_queue_payload, log_queue_action, queue_task_for_project
from shared.task_store import TASK_BUCKET, get_project_task, project_task_key


def handler(event, context):
    params = event['pathParameters']
    project_id = params['projectId']
    task_id = params['taskId']

    project = get_project(project_id)
    task = ensure_task_shape(get_project_task(project_id, task_id))
    conversation = ensure_conversation(task)
    if not conversation.get('readyForEngine'):
        target = 'Codex Cloud' if is_codex_cloud_project(project) else 'the engine'
        return response(400, {'message': f'This task is not ready for {target} yet. Continue chatting with the assistant first.'})

    goal = str(task.get('instructions', {}).get('goal') or '').strip()
    success_criteria = task.get('instructions', {}).get('successCriteria') or []
    if not goal:
        return response(400, {'message': 'instructions.goal is required before promotion.'})
    if not isinstance(success_criteria, list) or not any(str(item).strip() for item in success_criteria):
        return response(400, {'message': 'instructions.successCriteria must be a non-empty array before promotion.'})

    timestamp = now_iso()
    if not is_codex_cloud_project(project):
        engine = ensure_engine(task)
        engine['queuedAt'] = timestamp
        set_status(task, 'queued_for_engine', 'queued_for_engine', 'Queued for engine.', timestamp)
    else:
        conversation['readyForEngine'] = False

    try:
        queue_task_for_project(project, task, timestamp)
    except RuntimeError as exc:
        return response(500, {'message': str(exc)})

    task_key = project_task_key(project_id, task_id)
    queue_payload = engine_queue_payload(project_id, task_id) if not is_codex_cloud_project(project) else {'taskBucket': TASK_BUCKET, 'taskKey': task_key, 'projectId': project_id, 'taskId': task_id}
    log_queue_action(
        'project_task_saved_before_queue',
        projectId=project_id,
        taskId=task_id,
        taskBucket=TASK_BUCKET,
        taskKey=task_key,
        status=task.get('status', {}),
    )
    log_queue_action(
        'project_task_queue_payload_pointer',
        projectId=project_id,
        taskId=task_id,
        taskBucket=queue_payload['taskBucket'],
        taskKey=queue_payload['taskKey'],
        status=task.get('status', {}),
    )
    return response(200, {'ok': True, 'task': task})
