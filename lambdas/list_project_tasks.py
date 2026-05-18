from shared.http import response
from shared.task_store import list_project_tasks


def handler(event, context):
    project_id = event['pathParameters']['projectId']
    return response(200, {'tasks': list_project_tasks(project_id)})
