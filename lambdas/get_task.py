import json
from shared.task_store import get_task


def handler(event, context):
    task_id = event['pathParameters']['taskId']
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(get_task(task_id)),
    }
