import json
from shared.task_store import put_task
# mika testing

def handler(event, context):
    payload = json.loads(event['body'] or '{}')
    task = {
        'taskId': payload['taskId'],
        'project': payload['project'],
        'instructions': payload['instructions'],
        'status': payload.get('status', {
            'flag': 'idle',
            'phase': 'idle',
            'message': '',
            'updatedAt': '',
            'lastError': '',
            'isComplete': False,
            'humanStopRequested': False,
        }),
        'progress': payload.get('progress', {'iteration': 0, 'history': []}),
        'limits': payload['limits'],
    }
    return {
        'statusCode': 201,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(put_task(task)),
    }
