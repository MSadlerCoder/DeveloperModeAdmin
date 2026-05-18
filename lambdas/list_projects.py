from shared.http import response
from shared.project_store import list_projects


def handler(event, context):
    return response(200, {'projects': list_projects()})
