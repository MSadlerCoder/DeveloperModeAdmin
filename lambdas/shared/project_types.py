from typing import Any, Dict

REMOTE_EC2 = 'remote_ec2'
CODEX_CLOUD = 'codex_cloud'
SUPPORTED_PROJECT_TYPES = {REMOTE_EC2, CODEX_CLOUD}


def get_project_type(project: Dict[str, Any] | None) -> str:
    value = (project or {}).get('projectType') or REMOTE_EC2
    value = str(value).strip()
    if value not in SUPPORTED_PROJECT_TYPES:
        raise ValueError(f"Unsupported projectType '{value}'. Supported values: {', '.join(sorted(SUPPORTED_PROJECT_TYPES))}.")
    return value


def is_remote_ec2_project(project: Dict[str, Any] | None) -> bool:
    return get_project_type(project) == REMOTE_EC2


def is_codex_cloud_project(project: Dict[str, Any] | None) -> bool:
    return get_project_type(project) == CODEX_CLOUD
