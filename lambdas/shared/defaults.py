from datetime import datetime, timezone
from typing import Any, Dict, Optional

from shared.project_types import CODEX_CLOUD, REMOTE_EC2, get_project_type
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
    'queued_for_engine',
    'engine_running',
    'submitting_to_codex',
    'waiting_for_codex',
    'codex_running',
}
TERMINAL_STATUS_FLAGS = {'complete', 'completed', 'awaiting_review', 'error', 'failed', 'stopped', 'codex_completed', 'codex_failed'}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"


def project_snapshot(project: Dict[str, Any]) -> Dict[str, Any]:
    project_type = get_project_type(project)
    snapshot: Dict[str, Any] = {
        'projectId': project['projectId'],
        'name': project.get('name', ''),
        'description': project.get('description', ''),
        'projectType': project_type,
        'publicUrl': project.get('publicUrl', ''),
        'notes': project.get('notes', []),
        'conventions': project.get('conventions', []),
    }
    if project_type == CODEX_CLOUD:
        codex = project.get('codex') or {}
        snapshot['codex'] = {
            'environmentId': codex.get('environmentId', ''),
            'defaultAttempts': int(codex.get('defaultAttempts') or 1),
            'pollDelaySeconds': int(codex.get('pollDelaySeconds') or 15),
            'postCompletionAction': codex.get('postCompletionAction', 'notify_only'),
        }
        return snapshot

    snapshot.update({
        'sshHost': project.get('sshHost', ''),
        'sshPort': int(project.get('sshPort') or 22),
        'sshUser': project.get('sshUser', 'ubuntu'),
        'sshPrivateKeySecretName': project.get('sshPrivateKeySecretName', ''),
        'projectPath': project.get('projectPath', ''),
        'engineInstructions': project.get('engineInstructions', ''),
    })
    return snapshot


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
        'flag': 'queued_for_engine',
        'phase': 'queued_for_engine',
        'message': 'Task queued for engine processing.',
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



def codex_queued_status(timestamp: str) -> Dict[str, Any]:
    return {
        'flag': 'queued',
        'phase': 'codex_queued',
        'message': 'Task queued for Codex Cloud.',
        'updatedAt': timestamp,
        'lastError': '',
        'isComplete': False,
        'humanStopRequested': False,
    }
