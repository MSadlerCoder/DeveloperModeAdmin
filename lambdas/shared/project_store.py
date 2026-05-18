import json
import os
from typing import Any, Dict, List

import boto3

s3 = boto3.client('s3')
TASK_BUCKET = os.environ['TASK_BUCKET']
PROJECT_PREFIX = os.environ.get('PROJECT_PREFIX', 'projects/')


def _project_key(project_id: str) -> str:
    return f"{PROJECT_PREFIX}{project_id}.json"


def list_projects() -> List[Dict[str, Any]]:
    paginator = s3.get_paginator('list_objects_v2')
    projects: List[Dict[str, Any]] = []
    for page in paginator.paginate(Bucket=TASK_BUCKET, Prefix=PROJECT_PREFIX):
        for item in page.get('Contents', []):
            key = item['Key']
            if not key.endswith('.json'):
                continue
            obj = s3.get_object(Bucket=TASK_BUCKET, Key=key)
            projects.append(json.loads(obj['Body'].read().decode('utf-8')))
    return sorted(projects, key=lambda project: project.get('updatedAt', ''), reverse=True)


def get_project(project_id: str) -> Dict[str, Any]:
    obj = s3.get_object(Bucket=TASK_BUCKET, Key=_project_key(project_id))
    return json.loads(obj['Body'].read().decode('utf-8'))


def put_project(project: Dict[str, Any]) -> Dict[str, Any]:
    s3.put_object(
        Bucket=TASK_BUCKET,
        Key=_project_key(project['projectId']),
        Body=json.dumps(project, indent=2).encode('utf-8'),
        ContentType='application/json',
    )
    return project


def delete_project(project_id: str) -> None:
    s3.delete_object(Bucket=TASK_BUCKET, Key=_project_key(project_id))
