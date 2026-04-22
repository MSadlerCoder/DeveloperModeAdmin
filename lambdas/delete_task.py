from shared.task_store import delete_task


def handler(event, context):
    task_id = event['pathParameters']['taskId']
    delete_task(task_id)
    return {
        'statusCode': 204,
        'headers': {
            'Access-Control-Allow-Origin': '*',
        },
        'body': '',
    }
