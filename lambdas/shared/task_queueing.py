import json
import os
from typing import Any, Dict

import boto3

from shared.codex_prompt import compose_codex_prompt, write_codex_prompt
from shared.defaults import codex_queued_status, now_iso, queued_status
from shared.project_types import is_codex_cloud_project
from shared.task_chat import append_message, build_engine_queue_payload, ensure_conversation, set_status
from shared.task_store import TASK_BUCKET, file_index_key, project_task_key, put_project_task

sqs = boto3.client('sqs')
TASK_QUEUE_URL = os.environ.get('TASK_QUEUE_URL', '')
TASK_MESSAGE_QUEUE_URL = os.environ.get('TASK_MESSAGE_QUEUE_URL', '')
CODEX_TASK_QUEUE_URL = os.environ.get('CODEX_TASK_QUEUE_URL', '')
RUN_COMMANDS = {'/run', '/queue', '/start'}


def resolve_queue_url(queue_url_or_name: str) -> str:
    if not queue_url_or_name:
        return ''
    if queue_url_or_name.startswith('http://') or queue_url_or_name.startswith('https://'):
        return queue_url_or_name
    return sqs.get_queue_url(QueueName=queue_url_or_name)['QueueUrl']


def log_queue_action(message: str, **details: Any) -> None:
    print(json.dumps({'message': message, **details}, default=str))


def should_enqueue_engine(payload: Dict[str, Any], content: str) -> bool:
    normalized = (content or payload.get('content') or payload.get('message') or '').strip().lower()
    return bool(payload.get('enqueue')) or normalized in RUN_COMMANDS


def engine_queue_payload(project_id: str, task_id: str) -> Dict[str, Any]:
    return build_engine_queue_payload(
        project_id,
        task_id,
        TASK_BUCKET,
        project_task_key(project_id, task_id),
        file_index_key(project_id, task_id),
    )


def codex_queue_payload(project_id: str, task_id: str) -> Dict[str, Any]:
    return {
        'taskBucket': TASK_BUCKET,
        'taskKey': project_task_key(project_id, task_id),
        'projectId': project_id,
        'taskId': task_id,
    }


def queue_engine(project_id: str, task_id: str, task: Dict[str, Any] | None = None) -> None:
    if not TASK_QUEUE_URL:
        raise RuntimeError('TASK_QUEUE_URL is not configured.')
    payload = engine_queue_payload(project_id, task_id)
    sqs.send_message(
        QueueUrl=resolve_queue_url(TASK_QUEUE_URL),
        MessageBody=json.dumps(payload),
    )
    log_queue_action(
        'project_task_sent_to_engine_queue',
        projectId=project_id,
        taskId=task_id,
        taskBucket=payload['taskBucket'],
        taskKey=payload['taskKey'],
        fileIndexKey=payload['fileIndexKey'],
        status=(task or {}).get('status', {}),
    )


def prepare_codex_task(project: Dict[str, Any], task: Dict[str, Any], timestamp: str | None = None) -> Dict[str, Any]:
    ts = timestamp or now_iso()
    codex_project = project.get('codex') or task.get('project', {}).get('codex') or {}
    prompt = compose_codex_prompt(task, project)
    prompt_key = write_codex_prompt(task['projectId'], task['taskId'], prompt)
    task['projectType'] = 'codex_cloud'
    task['codex'] = {
        **(task.get('codex') or {}),
        'promptS3Key': prompt_key,
        'taskType': (task.get('codex') or {}).get('taskType') or 'investigation',
        'attempts': int((task.get('codex') or {}).get('attempts') or codex_project.get('defaultAttempts') or 1),
        'environmentId': codex_project.get('environmentId', ''),
    }
    task['status'] = codex_queued_status(ts)
    task['updatedAt'] = ts
    return task


def queue_codex(project_id: str, task_id: str, task: Dict[str, Any] | None = None) -> None:
    if not CODEX_TASK_QUEUE_URL:
        raise RuntimeError('CODEX_TASK_QUEUE_URL is not configured.')
    payload = codex_queue_payload(project_id, task_id)
    sqs.send_message(
        QueueUrl=resolve_queue_url(CODEX_TASK_QUEUE_URL),
        MessageBody=json.dumps(payload),
    )
    log_queue_action(
        'project_task_sent_to_codex_queue',
        projectId=project_id,
        taskId=task_id,
        taskBucket=payload['taskBucket'],
        taskKey=payload['taskKey'],
        status=(task or {}).get('status', {}),
    )


def queue_task_for_project(project: Dict[str, Any], task: Dict[str, Any], timestamp: str | None = None) -> Dict[str, Any]:
    ts = timestamp or now_iso()
    project_id = task['projectId']
    task_id = task['taskId']
    if is_codex_cloud_project(project):
        prepare_codex_task(project, task, ts)
        put_project_task(task)
        queue_codex(project_id, task_id, task)
        return task

    task['status'] = queued_status(ts)
    task['updatedAt'] = ts
    put_project_task(task)
    queue_engine(project_id, task_id, task)
    return task


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


def append_task_message_and_queue_reply(task: Dict[str, Any], project_id: str, task_id: str, content: str, payload: Dict[str, Any] | None = None, timestamp: str | None = None, project: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = payload or {}
    ts = timestamp or now_iso()
    user_message = append_message(task, 'user', content, ts)

    if should_enqueue_engine(payload, content):
        conversation = ensure_conversation(task)
        conversation['readyForEngine'] = False
        target_project = project or task.get('project') or {'projectType': 'remote_ec2'}
        if is_codex_cloud_project(target_project):
            append_message(task, 'assistant', 'The task has been queued for Codex Cloud. I’ll update this conversation when Codex Cloud status changes are available.', ts)
        else:
            append_message(task, 'assistant', 'The task has been sent to the engine. I’ll update this conversation when the engine run finishes.', ts)
        queue_task_for_project(target_project, task, ts)
    else:
        conversation = ensure_conversation(task)
        conversation['readyForEngine'] = False
        conversation['engineSummary'] = None
        set_status(task, 'waiting_for_reply', 'waiting_for_reply', 'Assistant is thinking...', ts)
        queue_assistant_reply(project_id, task_id, user_message['id'])

    return task
