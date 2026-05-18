from shared.http import response
from shared.project_store import get_project


def handler(event, context):
    project_id = event['pathParameters']['projectId']
    return response(200, get_project(project_id))
