from typing import Any, Dict, Iterable

from shared.task_chat import ensure_conversation
from shared.task_store import TASK_BUCKET, TASK_PREFIX, s3


def codex_prompt_key(project_id: str, task_id: str) -> str:
    return f"{TASK_PREFIX}{project_id}/{task_id}/codex-prompt.txt"


def _lines(title: str, values: Iterable[Any]) -> list[str]:
    clean = [str(value).strip() for value in values if str(value or '').strip()]
    if not clean:
        return [f"## {title}", "None provided.", ""]
    return [f"## {title}", *[f"- {value}" for value in clean], ""]


def compose_codex_prompt(task: Dict[str, Any], project: Dict[str, Any]) -> str:
    instructions = task.get('instructions') or {}
    conversation = ensure_conversation(task)
    messages = conversation.get('messages') or []
    project_snapshot = task.get('project') or {}
    project_notes = project_snapshot.get('notes') or project.get('notes') or []
    project_conventions = project_snapshot.get('conventions') or project.get('conventions') or []
    project_instructions = project_snapshot.get('engineInstructions') or project.get('engineInstructions') or ''

    parts: list[str] = [
        "# Codex Cloud Task",
        "",
        "Inspect the repository, understand the current implementation, and perform the requested work. Do not assume the dashboard has deployed or published changes; produce work that can be reviewed in Codex Cloud.",
        "",
        "## Title",
        str(task.get('title') or 'Untitled Task').strip(),
        "",
        "## Goal",
        str(instructions.get('goal') or '').strip() or 'No goal provided.',
        "",
    ]
    parts.extend(_lines('Notes', instructions.get('notes') or []))
    parts.extend(_lines('Success criteria', instructions.get('successCriteria') or []))
    if project_instructions:
        parts.extend(['## Project-level instructions', str(project_instructions).strip(), ''])
    parts.extend(_lines('Project notes', project_notes))
    parts.extend(_lines('Project conventions', project_conventions))

    relevant_messages = []
    for message in messages[-20:]:
        role = message.get('role')
        content = str(message.get('content') or '').strip()
        if role in {'user', 'assistant', 'system'} and content:
            relevant_messages.append(f"### {role}\n{content}")
    parts.append('## Relevant planning conversation')
    parts.append('\n\n'.join(relevant_messages) if relevant_messages else 'No planning conversation provided.')
    parts.append('')
    return '\n'.join(parts).strip() + '\n'


def write_codex_prompt(project_id: str, task_id: str, prompt: str) -> str:
    key = codex_prompt_key(project_id, task_id)
    s3.put_object(
        Bucket=TASK_BUCKET,
        Key=key,
        Body=prompt.encode('utf-8'),
        ContentType='text/plain; charset=utf-8',
    )
    return key
