import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List

import boto3

from shared.defaults import now_iso
from shared.task_chat import (
    append_message,
    conversation_for_prompt,
    ensure_conversation,
    ensure_task_shape,
    has_assistant_reply_for,
    normalize_ai_response,
    set_status,
)
from shared.task_store import get_project_task, put_project_task

SYSTEM_PROMPT = """You are the fast planning assistant inside Developer Mode.

Your job is to help the user clarify and prepare a coding task before it is sent to the full autonomous engine.

You do not modify files.
You do not connect to servers.
You do not run commands.
You do not claim that implementation work has been completed.

You can:
- discuss the task with the user
- ask clarifying questions
- identify missing requirements
- propose implementation plans
- summarise the task for the engine
- decide whether the task is ready for the engine

Return only valid JSON with this shape:

{
  "reply": "string",
  "readyForEngine": boolean,
  "engineSummary": "string or null"
}

Set readyForEngine to true only when the task is specific enough that the engine can begin work without needing another user decision.

When readyForEngine is true, engineSummary must be a concise but complete instruction for the engine.

When readyForEngine is false, engineSummary must be null."""


def _project_context(task: Dict[str, Any]) -> str:
    project = task.get('project') or {}
    instructions = task.get('instructions') or {}
    return json.dumps({
        'taskId': task.get('taskId'),
        'title': task.get('title'),
        'project': {
            'name': project.get('name'),
            'description': project.get('description'),
            'projectPath': project.get('projectPath'),
            'engineInstructions': project.get('engineInstructions'),
            'notes': project.get('notes'),
            'conventions': project.get('conventions'),
        },
        'instructions': instructions,
        'currentEngineSummary': (task.get('conversation') or {}).get('engineSummary'),
    }, indent=2)


def _call_openai(messages: List[Dict[str, str]]) -> str:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY is not configured.')
    model = os.environ.get('TASK_CHAT_MODEL') or os.environ.get('OPENAI_MODEL')
    if not model:
        raise RuntimeError('TASK_CHAT_MODEL or OPENAI_MODEL is required when using OpenAI.')
    payload = {
        'model': model,
        'messages': messages,
        'temperature': float(os.environ.get('TASK_CHAT_TEMPERATURE', '0.2')),
        'response_format': {'type': 'json_object'},
    }
    request = urllib.request.Request(
        os.environ.get('OPENAI_CHAT_COMPLETIONS_URL', 'https://api.openai.com/v1/chat/completions'),
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=int(os.environ.get('TASK_CHAT_TIMEOUT_SECONDS', '25'))) as opened:
            response = json.loads(opened.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'OpenAI request failed with {exc.code}: {body[:500]}') from exc
    return response['choices'][0]['message']['content']


def _call_bedrock(messages: List[Dict[str, str]]) -> str:
    model_id = os.environ.get('TASK_CHAT_MODEL') or os.environ.get('BEDROCK_MODEL_ID')
    if not model_id:
        raise RuntimeError('TASK_CHAT_MODEL or BEDROCK_MODEL_ID is required when using Bedrock.')
    client = boto3.client('bedrock-runtime')
    bedrock_messages = []
    for message in messages:
        role = 'assistant' if message['role'] == 'assistant' else 'user'
        bedrock_messages.append({'role': role, 'content': [{'text': message['content']}]})
    response = client.converse(
        modelId=model_id,
        system=[{'text': SYSTEM_PROMPT}],
        messages=bedrock_messages,
        inferenceConfig={
            'temperature': float(os.environ.get('TASK_CHAT_TEMPERATURE', '0.2')),
            'maxTokens': int(os.environ.get('TASK_CHAT_MAX_TOKENS', '1200')),
        },
    )
    return response['output']['message']['content'][0]['text']


def _generate_reply(task: Dict[str, Any]) -> Dict[str, Any]:
    provider = (os.environ.get('TASK_CHAT_PROVIDER') or '').strip().lower()
    messages = [
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': 'Task and project context:\n' + _project_context(task)},
        *conversation_for_prompt(ensure_conversation(task).get('messages', [])),
    ]
    if provider == 'openai' or (not provider and os.environ.get('OPENAI_API_KEY')):
        return normalize_ai_response(_call_openai(messages))
    if provider == 'bedrock' or (not provider and (os.environ.get('TASK_CHAT_MODEL') or os.environ.get('BEDROCK_MODEL_ID'))):
        # Bedrock receives the system prompt through the Converse system field, so remove the chat-style system item.
        return normalize_ai_response(_call_bedrock([message for message in messages if message['role'] != 'system']))
    raise RuntimeError('No task chat AI provider is configured. Set TASK_CHAT_PROVIDER plus TASK_CHAT_MODEL, or configure OPENAI_API_KEY.')


def _process_record(record: Dict[str, Any]) -> None:
    body = json.loads(record.get('body') or '{}')
    project_id = body['projectId']
    task_id = body['taskId']
    message_id = body['messageId']

    task = ensure_task_shape(get_project_task(project_id, task_id))
    if has_assistant_reply_for(task, message_id):
        return

    timestamp = now_iso()
    set_status(task, 'replying', 'replying', 'Assistant is replying...', timestamp)
    put_project_task(task)

    try:
        ai_response = _generate_reply(task)
        # Reload before appending so status-only writes do not discard newer task metadata.
        task = ensure_task_shape(get_project_task(project_id, task_id))
        if has_assistant_reply_for(task, message_id):
            return
        timestamp = now_iso()
        conversation = ensure_conversation(task)
        append_message(
            task,
            'assistant',
            ai_response['reply'],
            timestamp,
            replyToMessageId=message_id,
            readyForEngine=ai_response['readyForEngine'],
        )
        conversation['readyForEngine'] = ai_response['readyForEngine']
        conversation['engineSummary'] = ai_response['engineSummary']
        set_status(task, 'ready_for_engine' if ai_response['readyForEngine'] else 'ready', 'ready_for_engine' if ai_response['readyForEngine'] else 'ready', 'Ready for the next message.' if not ai_response['readyForEngine'] else 'Ready to promote to engine.', timestamp)
        put_project_task(task)
    except Exception as exc:
        task = ensure_task_shape(get_project_task(project_id, task_id))
        if not has_assistant_reply_for(task, message_id):
            timestamp = now_iso()
            append_message(
                task,
                'assistant',
                'I hit an error while preparing a reply. Please try sending the message again or check the task chat AI configuration.',
                timestamp,
                replyToMessageId=message_id,
                readyForEngine=False,
            )
        conversation = ensure_conversation(task)
        conversation['readyForEngine'] = False
        conversation['engineSummary'] = None
        task['lastChatError'] = {'message': str(exc), 'at': now_iso()}
        set_status(task, 'error', 'replying', f'Task chat reply failed: {exc}', now_iso(), str(exc))
        put_project_task(task)


def handler(event, context):
    failures = []
    for record in event.get('Records', []):
        try:
            _process_record(record)
        except Exception:
            failures.append({'itemIdentifier': record.get('messageId')})
    return {'batchItemFailures': failures}
