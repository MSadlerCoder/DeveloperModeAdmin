from shared.defaults import ACTIVE_STATUS_FLAGS, TERMINAL_STATUS_FLAGS, chat_message, now_iso
from shared.http import response
from shared.task_store import get_project_task, put_project_task


def _summarize(task):
    status = task.get('status', {})
    flag = status.get('flag', '')
    if flag in ACTIVE_STATUS_FLAGS or flag not in TERMINAL_STATUS_FLAGS:
        return task

    messages = task.setdefault('conversation', {}).setdefault('messages', [])
    if any(message.get('role') in {'assistant', 'engine', 'system'} and f"Engine run finished with status: {flag}" in message.get('content', '') for message in messages):
        return task

    lines = [f"Engine run finished with status: {flag}."]
    if status.get('message'):
        lines.append(status['message'])
    if status.get('lastError'):
        lines.append(f"Last error: {status['lastError']}")

    history = task.get('progress', {}).get('history', [])[-3:]
    summaries = [item.get('summary') or item.get('message') or item.get('kind') for item in history if isinstance(item, dict)]
    if summaries:
        lines.append('Recent progress: ' + ' | '.join(str(summary) for summary in summaries if summary))

    timestamp = now_iso()
    messages.append(chat_message('assistant', '\n'.join(lines), timestamp))
    task['updatedAt'] = timestamp
    put_project_task(task)
    return task


def handler(event, context):
    params = event['pathParameters']
    task = get_project_task(params['projectId'], params['taskId'])
    return response(200, _summarize(task))
