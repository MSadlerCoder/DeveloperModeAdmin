from shared.http import response
from shared.project_store import delete_project


def handler(event, context):
    project_id = event['pathParameters']['projectId']
    delete_project(project_id)
    return response(204, None, {'Content-Type': 'text/plain'})
