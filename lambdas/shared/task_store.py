import json
import os
from typing import Any, Dict, List

import boto3

s3 = boto3.client('s3')
TASK_BUCKET = os.environ['TASK_BUCKET']
TASK_PREFIX = os.environ.get('TASK_PREFIX', 'tasks/')


def _task_key(task_id: str) -> str:
    return f"{TASK_PREFIX}{task_id}.json"


def list_tasks() -> List[Dict[str, Any]]:
    paginator = s3.get_paginator('list_objects_v2')
    tasks: List[Dict[str, Any]] = []
    for page in paginator.paginate(Bucket=TASK_BUCKET, Prefix=TASK_PREFIX):
        for item in page.get('Contents', []):
            key = item['Key']
            if not key.endswith('.json'):
                continue
            obj = s3.get_object(Bucket=TASK_BUCKET, Key=key)
            tasks.append(json.loads(obj['Body'].read().decode('utf-8')))
    return sorted(tasks, key=lambda task: task.get('status', {}).get('updatedAt', ''), reverse=True)


def get_task(task_id: str) -> Dict[str, Any]:
    obj = s3.get_object(Bucket=TASK_BUCKET, Key=_task_key(task_id))
    return json.loads(obj['Body'].read().decode('utf-8'))


def put_task(task: Dict[str, Any]) -> Dict[str, Any]:
    s3.put_object(
        Bucket=TASK_BUCKET,
        Key=_task_key(task['taskId']),
        Body=json.dumps(task, indent=2).encode('utf-8'),
        ContentType='application/json',
    )
    return task


def delete_task(task_id: str) -> None:
    s3.delete_object(Bucket=TASK_BUCKET, Key=_task_key(task_id))
