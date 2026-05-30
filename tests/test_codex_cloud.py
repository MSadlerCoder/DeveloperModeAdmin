import importlib
import json
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAMBDAS = ROOT / 'lambdas'
if str(LAMBDAS) not in sys.path:
    sys.path.insert(0, str(LAMBDAS))


class FakeBody:
    def __init__(self, data):
        self.data = data
    def read(self):
        return self.data


class FakeS3:
    def __init__(self):
        self.objects = {}
    def put_object(self, Bucket, Key, Body, ContentType=None):
        self.objects[(Bucket, Key)] = Body if isinstance(Body, bytes) else Body.encode('utf-8')
    def get_object(self, Bucket, Key):
        return {'Body': FakeBody(self.objects[(Bucket, Key)])}
    def delete_object(self, Bucket, Key):
        self.objects.pop((Bucket, Key), None)
    def get_paginator(self, name):
        raise NotImplementedError


class FakeSQS:
    def __init__(self):
        self.messages = []
    def send_message(self, QueueUrl, MessageBody):
        self.messages.append({'QueueUrl': QueueUrl, 'MessageBody': MessageBody})
    def get_queue_url(self, QueueName):
        return {'QueueUrl': f'https://example.test/{QueueName}'}


def load_modules(monkeypatch):
    fake_s3 = FakeS3()
    fake_sqs = FakeSQS()
    monkeypatch.setenv('TASK_BUCKET', 'bucket')
    monkeypatch.setenv('TASK_PREFIX', 'tasks/')
    monkeypatch.setenv('PROJECT_PREFIX', 'projects/')
    monkeypatch.setenv('TASK_QUEUE_URL', 'remote-queue')
    monkeypatch.setenv('TASK_MESSAGE_QUEUE_URL', 'message-queue')
    monkeypatch.setenv('CODEX_TASK_QUEUE_URL', 'codex-queue')
    monkeypatch.setenv('CODEX_RUNNER_HOST', 'runner.internal')
    monkeypatch.setenv('CODEX_RUNNER_SSH_PRIVATE_KEY_SECRET_NAME', 'secret/name')
    monkeypatch.setenv('CODEX_RUNNER_PORT', '22')
    monkeypatch.setenv('CODEX_RUNNER_USER', 'ubuntu')
    monkeypatch.setenv('CODEX_RUNNER_PATH', '/opt/DevMode_CodexCLIRunner')
    monkeypatch.setenv('CODEX_DEFAULT_ATTEMPTS', '1')
    monkeypatch.setenv('CODEX_POLL_DELAY_SECONDS', '15')
    monkeypatch.setenv('CODEX_POST_COMPLETION_ACTION', 'notify_only')

    fake_boto3 = types.SimpleNamespace(client=lambda name: fake_s3 if name == 's3' else fake_sqs)
    monkeypatch.setitem(sys.modules, 'boto3', fake_boto3)
    for name in list(sys.modules):
        if name.startswith('shared.') or name in {'create_project', 'update_project', 'create_project_task', 'promote_project_task', 'send_task_message'}:
            sys.modules.pop(name, None)
    modules = {
        name: importlib.import_module(name)
        for name in ['create_project', 'update_project', 'create_project_task', 'promote_project_task', 'send_task_message', 'shared.project_store', 'shared.task_store']
    }
    return fake_s3, fake_sqs, modules


def body(response):
    return json.loads(response['body'])


def test_project_type_defaults_and_codex_creation(monkeypatch):
    _, _, modules = load_modules(monkeypatch)
    create = modules['create_project']

    remote = body(create.handler({'body': json.dumps({'name': 'Remote', 'sshHost': 'h', 'projectPath': '/app'})}, None))
    assert remote['projectType'] == 'remote_ec2'

    codex = body(create.handler({'body': json.dumps({'name': 'Codex', 'projectType': 'codex_cloud', 'codex': {'environmentId': 'env_example'}})}, None))
    assert codex['projectType'] == 'codex_cloud'
    assert codex['codex']['environmentId'] == 'env_example'
    assert codex['codex']['runnerHost'] == 'runner.internal'
    assert codex['codex']['sshPrivateKeySecretName'] == 'secret/name'
    assert codex['codex']['defaultAttempts'] == 1

    missing = create.handler({'body': json.dumps({'projectType': 'codex_cloud', 'codex': {}})}, None)
    assert missing['statusCode'] == 400

    unknown = create.handler({'body': json.dumps({'projectType': 'weird'})}, None)
    assert unknown['statusCode'] == 400


def test_codex_update_preserves_hidden_runner_values(monkeypatch):
    _, _, modules = load_modules(monkeypatch)
    create = modules['create_project']
    update = modules['update_project']
    project = body(create.handler({'body': json.dumps({'projectId': 'project-codex', 'projectType': 'codex_cloud', 'codex': {'environmentId': 'env_one'}})}, None))
    updated = body(update.handler({
        'pathParameters': {'projectId': project['projectId']},
        'body': json.dumps({'codex': {'environmentId': 'env_two', 'runnerHost': 'evil', 'sshPrivateKeySecretName': 'evil'}}),
    }, None))
    assert updated['codex']['environmentId'] == 'env_two'
    assert updated['codex']['runnerHost'] == 'runner.internal'
    assert updated['codex']['sshPrivateKeySecretName'] == 'secret/name'


def test_codex_task_snapshot_is_safe(monkeypatch):
    _, _, modules = load_modules(monkeypatch)
    store = modules['shared.project_store']
    create_task = modules['create_project_task']
    store.put_project({
        'projectId': 'project-codex', 'name': 'Codex', 'description': '', 'projectType': 'codex_cloud',
        'codex': {'environmentId': 'env_example', 'runnerHost': 'runner.internal', 'runnerPort': 22, 'runnerUser': 'ubuntu', 'runnerPath': '/runner', 'sshPrivateKeySecretName': 'secret/name', 'defaultAttempts': 1, 'pollDelaySeconds': 15, 'postCompletionAction': 'notify_only'},
    })
    task = body(create_task.handler({'pathParameters': {'projectId': 'project-codex'}, 'body': json.dumps({'taskId': 'task-1', 'title': 'T', 'instructions': {'goal': 'Do it', 'successCriteria': ['Done']}, 'conversation': {'messages': [{'id': 'm1', 'role': 'user', 'content': 'plan', 'createdAt': 'now'}]}})}, None))
    assert task['projectType'] == 'codex_cloud'
    assert task['project']['codex']['environmentId'] == 'env_example'
    assert 'runnerHost' not in task['project']['codex']
    assert 'sshPrivateKeySecretName' not in task['project']['codex']


def test_codex_promotion_writes_prompt_and_routes_pointer_only(monkeypatch):
    fake_s3, fake_sqs, modules = load_modules(monkeypatch)
    project_store = modules['shared.project_store']
    task_store = modules['shared.task_store']
    promote = modules['promote_project_task']
    project_store.put_project({'projectId': 'project-codex', 'name': 'Codex', 'projectType': 'codex_cloud', 'codex': {'environmentId': 'env_example', 'defaultAttempts': 1, 'pollDelaySeconds': 15, 'postCompletionAction': 'notify_only'}})
    task_store.put_project_task({'taskId': 'task-1', 'projectId': 'project-codex', 'title': 'Fix bug', 'projectType': 'codex_cloud', 'project': {'projectId': 'project-codex', 'projectType': 'codex_cloud', 'codex': {'environmentId': 'env_example'}}, 'instructions': {'goal': 'Fix the login bug', 'notes': ['Use tests'], 'successCriteria': ['Login works']}, 'conversation': {'messages': [{'id': 'm1', 'role': 'user', 'content': 'Please fix login.', 'createdAt': 'now'}], 'readyForEngine': True}, 'status': {'flag': 'ready_for_engine', 'phase': 'ready_for_engine', 'message': '', 'updatedAt': '', 'lastError': '', 'isComplete': False, 'humanStopRequested': False}, 'progress': {'iteration': 0, 'history': []}, 'limits': {}, 'queueControl': {}, 'createdAt': 'now', 'updatedAt': 'now'})

    result = body(promote.handler({'pathParameters': {'projectId': 'project-codex', 'taskId': 'task-1'}}, None))
    task = result['task']
    assert task['status']['flag'] == 'queued'
    assert isinstance(task['status'], dict)
    assert task['codex']['promptS3Key'] == 'tasks/project-codex/task-1/codex-prompt.txt'
    prompt = fake_s3.objects[('bucket', task['codex']['promptS3Key'])].decode('utf-8')
    assert 'Fix the login bug' in prompt
    assert 'secret/name' not in prompt
    assert fake_sqs.messages[-1]['QueueUrl'] == 'https://example.test/codex-queue'
    sqs_body = json.loads(fake_sqs.messages[-1]['MessageBody'])
    assert sqs_body == {'taskBucket': 'bucket', 'taskKey': 'tasks/project-codex/task-1.json', 'projectId': 'project-codex', 'taskId': 'task-1'}
    assert 'Fix the login bug' not in fake_sqs.messages[-1]['MessageBody']


def test_remote_promotion_still_uses_remote_queue(monkeypatch):
    _, fake_sqs, modules = load_modules(monkeypatch)
    project_store = modules['shared.project_store']
    task_store = modules['shared.task_store']
    promote = modules['promote_project_task']
    project_store.put_project({'projectId': 'project-remote', 'name': 'Remote', 'sshHost': 'h', 'projectPath': '/app'})
    task_store.put_project_task({'taskId': 'task-1', 'projectId': 'project-remote', 'title': 'Build', 'project': {'projectId': 'project-remote'}, 'instructions': {'goal': 'Build it', 'notes': [], 'successCriteria': ['Built']}, 'conversation': {'messages': [], 'readyForEngine': True}, 'status': {'flag': 'ready_for_engine', 'phase': 'ready_for_engine', 'message': '', 'updatedAt': '', 'lastError': '', 'isComplete': False, 'humanStopRequested': False}, 'progress': {'iteration': 0, 'history': []}, 'limits': {}, 'queueControl': {}, 'createdAt': 'now', 'updatedAt': 'now'})
    task = body(promote.handler({'pathParameters': {'projectId': 'project-remote', 'taskId': 'task-1'}}, None))['task']
    assert task['status']['flag'] == 'queued_for_engine'
    assert fake_sqs.messages[-1]['QueueUrl'] == 'https://example.test/remote-queue'
    assert 'fileIndexKey' in json.loads(fake_sqs.messages[-1]['MessageBody'])


def test_chat_run_routes_codex_but_planning_message_does_not(monkeypatch):
    _, fake_sqs, modules = load_modules(monkeypatch)
    project_store = modules['shared.project_store']
    task_store = modules['shared.task_store']
    send = modules['send_task_message']
    project_store.put_project({'projectId': 'project-codex', 'projectType': 'codex_cloud', 'codex': {'environmentId': 'env_example', 'defaultAttempts': 1}})
    base = {'taskId': 'task-1', 'projectId': 'project-codex', 'title': 'T', 'projectType': 'codex_cloud', 'project': {'projectId': 'project-codex', 'projectType': 'codex_cloud', 'codex': {'environmentId': 'env_example'}}, 'instructions': {'goal': 'Do it', 'notes': [], 'successCriteria': ['Done']}, 'conversation': {'messages': [], 'readyForEngine': True}, 'status': {'flag': 'ready_for_engine', 'phase': 'ready_for_engine', 'message': '', 'updatedAt': '', 'lastError': '', 'isComplete': False, 'humanStopRequested': False}, 'progress': {'iteration': 0, 'history': []}, 'limits': {}, 'queueControl': {}, 'createdAt': 'now', 'updatedAt': 'now'}
    task_store.put_project_task(dict(base))
    send.handler({'pathParameters': {'projectId': 'project-codex', 'taskId': 'task-1'}, 'body': json.dumps({'content': 'please refine'})}, None)
    assert fake_sqs.messages[-1]['QueueUrl'] == 'https://example.test/message-queue'
    task_store.put_project_task(dict(base))
    result = body(send.handler({'pathParameters': {'projectId': 'project-codex', 'taskId': 'task-1'}, 'body': json.dumps({'content': '/run'})}, None))
    assert result['status']['flag'] == 'queued'
    assert fake_sqs.messages[-1]['QueueUrl'] == 'https://example.test/codex-queue'
