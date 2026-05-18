import json
import re
from typing import Any, Dict, Iterable, Optional

from shared.defaults import chat_message, now_iso, new_id

CHAT_ACTIVE_STATUS_FLAGS = {
    'waiting_for_reply',
    'replying',
    'waiting_for_engine',
    'queued_for_engine',
    'engine_running',
}


def ensure_conversation(task: Dict[str, Any]) -> Dict[str, Any]:
    conversation = task.setdefault('conversation', {})
    messages = conversation.setdefault('messages', [])
    conversation.setdefault('readyForEngine', False)
    conversation.setdefault('engineSummary', None)
    if messages and not conversation.get('lastMessageId'):
        conversation['lastMessageId'] = messages[-1].get('id')
    return conversation


def ensure_engine(task: Dict[str, Any]) -> Dict[str, Any]:
    engine = task.setdefault('engine', {})
    engine.setdefault('queuedAt', None)
    engine.setdefault('startedAt', None)
    engine.setdefault('completedAt', None)
    engine.setdefault('lastRunId', None)
    return engine


def ensure_task_shape(task: Dict[str, Any]) -> Dict[str, Any]:
    ensure_conversation(task)
    ensure_engine(task)
    return task


def set_status(task: Dict[str, Any], flag: str, phase: str, message: str, timestamp: Optional[str] = None, last_error: str = '') -> None:
    ts = timestamp or now_iso()
    previous = task.get('status') if isinstance(task.get('status'), dict) else {}
    task['status'] = {
        **previous,
        'flag': flag,
        'phase': phase,
        'message': message,
        'updatedAt': ts,
        'lastError': last_error,
        'isComplete': flag in {'complete', 'awaiting_review'},
        'humanStopRequested': bool(previous.get('humanStopRequested', False)),
    }
    task['updatedAt'] = ts


def append_message(task: Dict[str, Any], role: str, content: str, timestamp: Optional[str] = None, **extra: Any) -> Dict[str, Any]:
    conversation = ensure_conversation(task)
    message = chat_message(role, content, timestamp)
    message.update({key: value for key, value in extra.items() if value is not None})
    conversation['messages'].append(message)
    conversation['lastMessageId'] = message['id']
    return message


def has_assistant_reply_for(task: Dict[str, Any], message_id: str) -> bool:
    messages = ensure_conversation(task).get('messages', [])
    return any(message.get('role') == 'assistant' and message.get('replyToMessageId') == message_id for message in messages)


def build_engine_queue_payload(project_id: str, task_id: str, task_bucket: str, task_key: str, file_index_key: str) -> Dict[str, Any]:
    return {
        'taskBucket': task_bucket,
        'taskKey': task_key,
        'fileIndexKey': file_index_key,
        'projectId': project_id,
        'taskId': task_id,
    }


def extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    candidate = (text or '').strip()
    if not candidate:
        return None
    if candidate.startswith('```'):
        candidate = re.sub(r'^```(?:json)?\s*', '', candidate, flags=re.IGNORECASE)
        candidate = re.sub(r'\s*```$', '', candidate).strip()
    try:
        parsed = json.loads(candidate)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    start = candidate.find('{')
    end = candidate.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        parsed = json.loads(candidate[start:end + 1])
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def normalize_ai_response(raw_text: str) -> Dict[str, Any]:
    parsed = extract_json_object(raw_text)
    if not parsed:
        return {
            'reply': raw_text.strip() or 'I could not generate a structured reply. Please send another message with the task details.',
            'readyForEngine': False,
            'engineSummary': None,
        }

    reply = str(parsed.get('reply') or parsed.get('content') or '').strip()
    ready = bool(parsed.get('readyForEngine'))
    engine_summary = parsed.get('engineSummary')
    if not reply:
        reply = 'I need a bit more detail before this is ready for the engine.'
        ready = False
    if ready:
        engine_summary = str(engine_summary or '').strip() or None
        if not engine_summary:
            ready = False
    else:
        engine_summary = None
    return {'reply': reply, 'readyForEngine': ready, 'engineSummary': engine_summary}


def conversation_for_prompt(messages: Iterable[Dict[str, Any]]) -> list[Dict[str, str]]:
    result = []
    for message in messages:
        role = message.get('role')
        if role not in {'user', 'assistant', 'system'}:
            continue
        content = str(message.get('content') or '').strip()
        if content:
            result.append({'role': role, 'content': content})
    return result[-20:]
