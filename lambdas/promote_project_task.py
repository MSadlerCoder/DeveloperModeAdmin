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


def _resolve_queue_url(queue_url_or_name):
    if not queue_url_or_name:
        return ''
    if queue_url_or_name.startswith('http://') or queue_url_or_name.startswith('https://'):
        return queue_url_or_name
    return sqs.get_queue_url(QueueName=queue_url_or_name)['QueueUrl']


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

    timestamp = now_iso()
    engine = ensure_engine(task)
    engine['queuedAt'] = timestamp
    set_status(task, 'waiting_for_engine', 'waiting_for_engine', 'Waiting for engine...', timestamp)
    put_project_task(task)

    sqs.send_message(
        QueueUrl=_resolve_queue_url(TASK_QUEUE_URL),
        MessageBody=json.dumps(build_engine_queue_payload(
            project_id,
            task_id,
            TASK_BUCKET,
            project_task_key(project_id, task_id),
            file_index_key(project_id, task_id),
        )),
    )
    return response(200, {'ok': True, 'task': task})
