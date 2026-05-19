import json
import os
import re
from typing import Any, Dict, List

import boto3

s3 = boto3.client('s3')
TASK_BUCKET = os.environ['TASK_BUCKET']
PROJECT_PREFIX = os.environ.get('PROJECT_PREFIX', 'projects/')
PROJECT_METADATA_RE = re.compile(r'^project-[^/]+\.json$')


def _project_key(project_id: str) -> str:
    return f"{PROJECT_PREFIX}{project_id}.json"


def _normalize_project_id(project_id: str) -> str:
    return str(project_id or '').strip().removesuffix('/')


def list_projects() -> List[Dict[str, Any]]:
    paginator = s3.get_paginator('list_objects_v2')
    projects_by_id: Dict[str, Dict[str, Any]] = {}

    for page in paginator.paginate(Bucket=TASK_BUCKET, Prefix=PROJECT_PREFIX, Delimiter='/'):
        raw_keys = [item.get('Key', '') for item in page.get('Contents', [])]
        raw_prefixes = [prefix.get('Prefix', '') for prefix in page.get('CommonPrefixes', [])]
        print(f'[list_projects] raw keys={raw_keys} raw prefixes={raw_prefixes}')

        metadata_keys: List[str] = []
        ignored_entries: List[str] = []

        for item in page.get('Contents', []):
            key = item.get('Key', '')
            file_name = key.removeprefix(PROJECT_PREFIX)
            if PROJECT_METADATA_RE.match(file_name):
                metadata_keys.append(key)
            else:
                ignored_entries.append(key)

        ignored_entries.extend(raw_prefixes)
        if metadata_keys:
            print(f'[list_projects] metadata keys={metadata_keys}')
        if ignored_entries:
            print(f'[list_projects] ignored non-metadata entries={ignored_entries}')

        for key in metadata_keys:
            obj = s3.get_object(Bucket=TASK_BUCKET, Key=key)
            project = json.loads(obj['Body'].read().decode('utf-8'))
            derived_project_id = key.removeprefix(PROJECT_PREFIX).removesuffix('.json')
            project_id = _normalize_project_id(project.get('projectId') or project.get('id') or derived_project_id)
            project['projectId'] = project_id

            if project_id in projects_by_id:
                print(f'[list_projects] duplicate project id detected={project_id}; preferring metadata object from {key}')
            projects_by_id[project_id] = project

    projects = sorted(projects_by_id.values(), key=lambda project: project.get('updatedAt', ''), reverse=True)
    print(f"[list_projects] final deduped project ids={[project.get('projectId') for project in projects]}")
    return projects


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
