import json
import os

import boto3

from shared.defaults import now_iso, queued_status
from shared.http import response
from shared.project_store import get_project
from shared.task_chat import append_message, build_engine_queue_payload, ensure_conversation, ensure_task_shape, set_status
from shared.task_store import TASK_BUCKET, file_index_key, get_project_task, project_task_key, put_project_task

sqs = boto3.client('sqs')
TASK_QUEUE_URL = os.environ.get('TASK_QUEUE_URL', '')
TASK_MESSAGE_QUEUE_URL = os.environ.get('TASK_MESSAGE_QUEUE_URL', '')
RUN_COMMANDS = {'/run', '/queue', '/start'}


def _resolve_queue_url(queue_url_or_name):
    if not queue_url_or_name:
        return ''
    if queue_url_or_name.startswith('http://') or queue_url_or_name.startswith('https://'):
        return queue_url_or_name
    return sqs.get_queue_url(QueueName=queue_url_or_name)['QueueUrl']


def _should_enqueue(payload):
    content = (payload.get('content') or payload.get('message') or '').strip().lower()
    return bool(payload.get('enqueue')) or content in RUN_COMMANDS


def _queue_engine(project_id, task_id):
    if not TASK_QUEUE_URL:
        raise RuntimeError('TASK_QUEUE_URL is not configured.')
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


def _queue_assistant_reply(project_id, task_id, message_id):
    if not TASK_MESSAGE_QUEUE_URL:
        raise RuntimeError('TASK_MESSAGE_QUEUE_URL is not configured.')
    sqs.send_message(
        QueueUrl=_resolve_queue_url(TASK_MESSAGE_QUEUE_URL),
        MessageBody=json.dumps({
            'projectId': project_id,
            'taskId': task_id,
            'messageId': message_id,
            'taskBucket': TASK_BUCKET,
            'taskKey': project_task_key(project_id, task_id),
        }),
    )


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
    user_message = append_message(task, 'user', content, timestamp)

    try:
        if _should_enqueue(payload):
            task['status'] = queued_status(timestamp)
            task['updatedAt'] = timestamp
            conversation = ensure_conversation(task)
            conversation['readyForEngine'] = False
            append_message(task, 'assistant', 'The task has been sent to the engine. I’ll update this conversation when the engine run finishes.', timestamp)
            put_project_task(task)
            _queue_engine(project_id, task_id)
        else:
            conversation = ensure_conversation(task)
            conversation['readyForEngine'] = False
            conversation['engineSummary'] = None
            set_status(task, 'waiting_for_reply', 'waiting_for_reply', 'Assistant is thinking...', timestamp)
            put_project_task(task)
            _queue_assistant_reply(project_id, task_id, user_message['id'])
    except RuntimeError as exc:
        return response(500, {'message': str(exc)})

    return response(200, task)
