import json
import os
from typing import Any, Dict

import boto3

from shared.defaults import now_iso, queued_status
from shared.task_chat import append_message, build_engine_queue_payload, ensure_conversation, set_status
from shared.task_store import TASK_BUCKET, file_index_key, project_task_key

sqs = boto3.client('sqs')
TASK_QUEUE_URL = os.environ.get('TASK_QUEUE_URL', '')
TASK_MESSAGE_QUEUE_URL = os.environ.get('TASK_MESSAGE_QUEUE_URL', '')
RUN_COMMANDS = {'/run', '/queue', '/start'}


def resolve_queue_url(queue_url_or_name: str) -> str:
    if not queue_url_or_name:
        return ''
    if queue_url_or_name.startswith('http://') or queue_url_or_name.startswith('https://'):
        return queue_url_or_name
    return sqs.get_queue_url(QueueName=queue_url_or_name)['QueueUrl']


def should_enqueue_engine(payload: Dict[str, Any], content: str) -> bool:
    normalized = (content or payload.get('content') or payload.get('message') or '').strip().lower()
    return bool(payload.get('enqueue')) or normalized in RUN_COMMANDS


def queue_engine(project_id: str, task_id: str) -> None:
    if not TASK_QUEUE_URL:
        raise RuntimeError('TASK_QUEUE_URL is not configured.')
    sqs.send_message(
        QueueUrl=resolve_queue_url(TASK_QUEUE_URL),
        MessageBody=json.dumps(build_engine_queue_payload(
            project_id,
            task_id,
            TASK_BUCKET,
            project_task_key(project_id, task_id),
            file_index_key(project_id, task_id),
        )),
    )


def queue_assistant_reply(project_id: str, task_id: str, message_id: str) -> None:
    if not TASK_MESSAGE_QUEUE_URL:
        raise RuntimeError('TASK_MESSAGE_QUEUE_URL is not configured.')
    sqs.send_message(
        QueueUrl=resolve_queue_url(TASK_MESSAGE_QUEUE_URL),
        MessageBody=json.dumps({
            'projectId': project_id,
            'taskId': task_id,
            'messageId': message_id,
            'taskBucket': TASK_BUCKET,
            'taskKey': project_task_key(project_id, task_id),
        }),
    )


def append_task_message_and_queue_reply(task: Dict[str, Any], project_id: str, task_id: str, content: str, payload: Dict[str, Any] | None = None, timestamp: str | None = None) -> Dict[str, Any]:
    payload = payload or {}
    ts = timestamp or now_iso()
    user_message = append_message(task, 'user', content, ts)

    if should_enqueue_engine(payload, content):
        task['status'] = queued_status(ts)
        task['updatedAt'] = ts
        conversation = ensure_conversation(task)
        conversation['readyForEngine'] = False
        append_message(task, 'assistant', 'The task has been sent to the engine. I’ll update this conversation when the engine run finishes.', ts)
        queue_engine(project_id, task_id)
    else:
        conversation = ensure_conversation(task)
        conversation['readyForEngine'] = False
        conversation['engineSummary'] = None
        set_status(task, 'waiting_for_reply', 'waiting_for_reply', 'Assistant is thinking...', ts)
        queue_assistant_reply(project_id, task_id, user_message['id'])

    return task
