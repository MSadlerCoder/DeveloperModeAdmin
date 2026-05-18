from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

ACTIVE_STATUS_FLAGS = {
    'queued',
    'running',
    'starting',
    'connected',
    'indexing',
    'thinking',
    'doing',
    'building',
    'build_failed',
    'checking',
    'continuing',
    'queued_for_continuation',
    'waiting_for_reply',
    'replying',
    'waiting_for_engine',
    'engine_running',
}
TERMINAL_STATUS_FLAGS = {'complete', 'awaiting_review', 'error', 'stopped'}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"


def project_snapshot(project: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'projectId': project['projectId'],
        'name': project.get('name', ''),
        'description': project.get('description', ''),
        'sshHost': project.get('sshHost', ''),
        'sshPort': int(project.get('sshPort') or 22),
        'sshUser': project.get('sshUser', 'ubuntu'),
        'sshPrivateKeySecretName': project.get('sshPrivateKeySecretName', ''),
        'projectPath': project.get('projectPath', ''),
        'publicUrl': project.get('publicUrl', ''),
        'engineInstructions': project.get('engineInstructions', ''),
        'notes': project.get('notes', []),
        'conventions': project.get('conventions', []),
    }


def default_status(timestamp: Optional[str] = None) -> Dict[str, Any]:
    return {
        'flag': 'idle',
        'phase': 'idle',
        'message': '',
        'updatedAt': timestamp or '',
        'lastError': '',
        'isComplete': False,
        'humanStopRequested': False,
    }


def queued_status(timestamp: str) -> Dict[str, Any]:
    return {
        'flag': 'queued',
        'phase': 'queued',
        'message': 'Task queued for engine run.',
        'updatedAt': timestamp,
        'lastError': '',
        'isComplete': False,
        'humanStopRequested': False,
    }


def default_limits() -> Dict[str, Any]:
    return {
        'maxAgentLoops': 20,
        'maxActionsPerThink': 6,
        'maxBuildsPerRun': 20,
        'maxInstallsPerRun': 2,
        'maxFilesWrittenPerRun': 20,
        'maxFileSizeBytes': 120000,
        'maxTotalNewDependencies': 4,
    }


def default_queue_control() -> Dict[str, Any]:
    return {
        'autoContinue': False,
        'maxQueueRuns': 1,
        'queueRunsUsed': 0,
        'lastRunOutcome': '',
        'lastRunReason': '',
    }


def chat_message(role: str, content: str, timestamp: Optional[str] = None) -> Dict[str, Any]:
    return {
        'id': new_id('msg'),
        'role': role,
        'content': content,
        'createdAt': timestamp or now_iso(),
    }
