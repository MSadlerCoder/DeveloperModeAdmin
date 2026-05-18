import json
import os
from typing import Any, Dict, List

import boto3

s3 = boto3.client('s3')
TASK_BUCKET = os.environ['TASK_BUCKET']
TASK_PREFIX = os.environ.get('TASK_PREFIX', 'tasks/')


def project_task_key(project_id: str, task_id: str) -> str:
    return f"{TASK_PREFIX}{project_id}/{task_id}.json"


def file_index_key(project_id: str, task_id: str) -> str:
    return f"{TASK_PREFIX}{project_id}/{task_id}/file_index.json"


def _flat_task_key(task_id: str) -> str:
    return f"{TASK_PREFIX}{task_id}.json"


def list_project_tasks(project_id: str) -> List[Dict[str, Any]]:
    paginator = s3.get_paginator('list_objects_v2')
    prefix = f"{TASK_PREFIX}{project_id}/"
    tasks: List[Dict[str, Any]] = []
    for page in paginator.paginate(Bucket=TASK_BUCKET, Prefix=prefix):
        for item in page.get('Contents', []):
            key = item['Key']
            if not key.endswith('.json') or key.endswith('/file_index.json'):
                continue
            relative = key[len(prefix):]
            if '/' in relative:
                continue
            obj = s3.get_object(Bucket=TASK_BUCKET, Key=key)
            tasks.append(json.loads(obj['Body'].read().decode('utf-8')))
    return sorted(tasks, key=lambda task: task.get('updatedAt') or task.get('status', {}).get('updatedAt', ''), reverse=True)


def get_project_task(project_id: str, task_id: str) -> Dict[str, Any]:
    obj = s3.get_object(Bucket=TASK_BUCKET, Key=project_task_key(project_id, task_id))
    return json.loads(obj['Body'].read().decode('utf-8'))


def put_project_task(task: Dict[str, Any]) -> Dict[str, Any]:
    s3.put_object(
        Bucket=TASK_BUCKET,
        Key=project_task_key(task['projectId'], task['taskId']),
        Body=json.dumps(task, indent=2).encode('utf-8'),
        ContentType='application/json',
    )
    return task


def delete_project_task(project_id: str, task_id: str) -> None:
    s3.delete_object(Bucket=TASK_BUCKET, Key=project_task_key(project_id, task_id))


# Legacy flat task helpers for old /tasks routes.
def list_tasks() -> List[Dict[str, Any]]:
    paginator = s3.get_paginator('list_objects_v2')
    tasks: List[Dict[str, Any]] = []
    for page in paginator.paginate(Bucket=TASK_BUCKET, Prefix=TASK_PREFIX):
        for item in page.get('Contents', []):
            key = item['Key']
            if not key.endswith('.json') or key.endswith('/file_index.json'):
                continue
            relative = key[len(TASK_PREFIX):]
            if '/' in relative:
                continue
            obj = s3.get_object(Bucket=TASK_BUCKET, Key=key)
            tasks.append(json.loads(obj['Body'].read().decode('utf-8')))
    return sorted(tasks, key=lambda task: task.get('status', {}).get('updatedAt', ''), reverse=True)


def get_task(task_id: str) -> Dict[str, Any]:
    obj = s3.get_object(Bucket=TASK_BUCKET, Key=_flat_task_key(task_id))
    return json.loads(obj['Body'].read().decode('utf-8'))


def put_task(task: Dict[str, Any]) -> Dict[str, Any]:
    s3.put_object(
        Bucket=TASK_BUCKET,
        Key=_flat_task_key(task['taskId']),
        Body=json.dumps(task, indent=2).encode('utf-8'),
        ContentType='application/json',
    )
    return task


def delete_task(task_id: str) -> None:
    s3.delete_object(Bucket=TASK_BUCKET, Key=_flat_task_key(task_id))
