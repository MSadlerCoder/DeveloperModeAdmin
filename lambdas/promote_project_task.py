import json
import os

import boto3

from shared.defaults import now_iso
from shared.http import response
from shared.project_store import get_project
from shared.task_chat import build_engine_queue_payload, ensure_conversation, ensure_engine, ensure_task_shape, set_status
from shared.task_store import TASK_BUCKET, file_index_key, get_project_task, project_task_key, put_project_task

sqs = boto3.client('sqs')
TASK_QUEUE_URL = os.environ.get('TASK_QUEUE_URL', '')
ENGINE_QUEUED_FLAG = 'queued_for_engine'
ENGINE_QUEUED_MESSAGE = 'Queued for engine.'


def _resolve_queue_url(queue_url_or_name):
    if not queue_url_or_name:
        return ''
    if queue_url_or_name.startswith('http://') or queue_url_or_name.startswith('https://'):
        return queue_url_or_name
    return sqs.get_queue_url(QueueName=queue_url_or_name)['QueueUrl']


def _log_queue_action(message, **details):
    print(json.dumps({'message': message, **details}, default=str))


def handler(event, context):
    params = event['pathParameters']
    project_id = params['projectId']
    task_id = params['taskId']

    if not TASK_QUEUE_URL:
        return response(500, {'message': 'TASK_QUEUE_URL is not configured.'})

    get_project(project_id)
    task = ensure_task_shape(get_project_task(project_id, task_id))
    conversation = ensure_conversation(task)
    if not conversation.get('readyForEngine'):
        return response(400, {'message': 'This task is not ready for the engine yet. Continue chatting with the assistant first.'})

    goal = str(task.get('instructions', {}).get('goal') or '').strip()
    success_criteria = task.get('instructions', {}).get('successCriteria') or []
    if not goal:
        return response(400, {'message': 'instructions.goal is required before promoting to engine.'})
    if not isinstance(success_criteria, list) or not any(str(item).strip() for item in success_criteria):
        return response(400, {'message': 'instructions.successCriteria must be a non-empty array before promoting to engine.'})

    timestamp = now_iso()
    engine = ensure_engine(task)
    engine['queuedAt'] = timestamp
    set_status(task, ENGINE_QUEUED_FLAG, ENGINE_QUEUED_FLAG, ENGINE_QUEUED_MESSAGE, timestamp)

    task_key = project_task_key(project_id, task_id)
    payload = build_engine_queue_payload(
        project_id,
        task_id,
        TASK_BUCKET,
        task_key,
        file_index_key(project_id, task_id),
    )
    put_project_task(task)
    _log_queue_action(
        'project_task_saved_before_engine_queue',
        projectId=project_id,
        taskId=task_id,
        taskBucket=TASK_BUCKET,
        taskKey=task_key,
        status=task.get('status', {}),
    )

    sqs.send_message(
        QueueUrl=_resolve_queue_url(TASK_QUEUE_URL),
        MessageBody=json.dumps(payload),
    )
    _log_queue_action(
        'project_task_sent_to_engine_queue',
        projectId=project_id,
        taskId=task_id,
        taskBucket=payload['taskBucket'],
        taskKey=payload['taskKey'],
        fileIndexKey=payload['fileIndexKey'],
        status=task.get('status', {}),
    )
    return response(200, {'ok': True, 'task': task})
