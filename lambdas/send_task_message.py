import json
import os

import boto3

from shared.defaults import chat_message, now_iso, queued_status
from shared.http import response
from shared.project_store import get_project
from shared.task_store import TASK_BUCKET, file_index_key, get_project_task, project_task_key, put_project_task

sqs = boto3.client('sqs')
TASK_QUEUE_URL = os.environ.get('TASK_QUEUE_URL', '')
RUN_COMMANDS = {'/run', '/queue', '/start'}


def _should_enqueue(payload):
    content = (payload.get('content') or payload.get('message') or '').strip().lower()
    return bool(payload.get('enqueue')) or content in RUN_COMMANDS


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
    task = get_project_task(project_id, task_id)
    timestamp = now_iso()
    task.setdefault('conversation', {}).setdefault('messages', []).append(chat_message('user', content, timestamp))

    if _should_enqueue(payload):
        if not TASK_QUEUE_URL:
            return response(500, {'message': 'TASK_QUEUE_URL is not configured.'})
        task['status'] = queued_status(timestamp)
        task['updatedAt'] = timestamp
        task['conversation']['messages'].append(chat_message('assistant', 'The task has been queued. I’ll update this conversation when the engine run finishes.', timestamp))
        put_project_task(task)
        sqs.send_message(
            QueueUrl=TASK_QUEUE_URL,
            MessageBody=json.dumps({
                'taskBucket': TASK_BUCKET,
                'taskKey': project_task_key(project_id, task_id),
                'fileIndexKey': file_index_key(project_id, task_id),
            }),
        )
    else:
        task['updatedAt'] = timestamp
        put_project_task(task)

    return response(200, task)
