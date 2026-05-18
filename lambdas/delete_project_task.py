from shared.http import response
from shared.task_store import delete_project_task


def handler(event, context):
    params = event['pathParameters']
    delete_project_task(params['projectId'], params['taskId'])
    return response(204, None, {'Content-Type': 'text/plain'})
