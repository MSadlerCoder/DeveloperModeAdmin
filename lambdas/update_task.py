import json
from shared.task_store import get_task, put_task


def handler(event, context):
    task_id = event['pathParameters']['taskId']
    existing = get_task(task_id)
    payload = json.loads(event['body'] or '{}')
    existing.update({
        'project': payload.get('project', existing['project']),
        'instructions': payload.get('instructions', existing['instructions']),
        'status': payload.get('status', existing['status']),
        'progress': payload.get('progress', existing['progress']),
        'limits': payload.get('limits', existing['limits']),
    })
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(put_task(existing)),
    }
