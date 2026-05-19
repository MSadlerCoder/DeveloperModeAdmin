import json
from shared.task_store import get_task, put_task


def handler(event, context):
    task_id = event['pathParameters']['taskId']
    existing = get_task(task_id)
    payload = json.loads(event['body'] or '{}')
    if 'project' in payload:
        existing['project'] = payload['project']
    if 'instructions' in payload:
        existing['instructions'] = {
            **existing.get('instructions', {}),
            **payload['instructions'],
        }
    if 'status' in payload:
        existing['status'] = {
            **existing.get('status', {}),
            **payload['status'],
        }
    if 'progress' in payload:
        existing['progress'] = {
            **existing.get('progress', {}),
            **payload['progress'],
        }
    if 'limits' in payload:
        existing['limits'] = {
            **existing.get('limits', {}),
            **payload['limits'],
        }
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(put_task(existing)),
    }
