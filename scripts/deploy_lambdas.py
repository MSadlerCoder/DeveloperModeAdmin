#!/usr/bin/env python3
"""Deploy Python Lambda functions from this repository.

Supports the TradeboxAPI-style module layout and this repository's current flat
`lambdas/` layout. In flat mode, the deployable module name comes from
`flat_root_module` in deploy_config.json.
"""
from __future__ import annotations

import argparse
import configparser
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError

PLACEHOLDER_RE = re.compile(r"\[([A-Z0-9_]+)\]")
SKIP_DIRS = {"__pycache__", ".pytest_cache"}
CONFIG_FILES = {
    "lambda_env",
    "lambda.env",
    "lambda_permissions.json",
    "api-routes.json",
    "api_routes.json",
    "sqs-triggers.json",
    "sqs_triggers.json",
}
RESERVED_ENV_KEYS = {
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
    "DEPLOY_VPC_ENABLED",
    "DEPLOY_SUBNET_IDS",
    "DEPLOY_SECURITY_GROUP_IDS",
    "LAMBDA_TIMEOUT",
    "LAMBDA_MEMORY_SIZE",
}
SHARED_NAMES = {"shared", "common", "__pycache__", ".pytest_cache"}


@dataclass(frozen=True)
class ModuleInfo:
    name: str
    path: Path
    flat_root: bool


def load_config(path: Path) -> dict[str, Any]:
    with path.open() as fh:
        raw = json.load(fh)
    deploy = raw.get("deploy", {})
    return {**raw, **deploy}


def resolve_placeholders(value: Any) -> Any:
    if isinstance(value, str):
        def repl(match: re.Match[str]) -> str:
            key = match.group(1)
            if key not in os.environ:
                raise RuntimeError(f"Missing required environment variable for placeholder [{key}]")
            return os.environ[key]
        return PLACEHOLDER_RE.sub(repl, value)
    if isinstance(value, list):
        return [resolve_placeholders(item) for item in value]
    if isinstance(value, dict):
        return {key: resolve_placeholders(item) for key, item in value.items()}
    return value


def read_text_resolved(path: Path) -> str:
    return resolve_placeholders(path.read_text())


def discover_modules(lambda_root: Path, config: dict[str, Any]) -> dict[str, ModuleInfo]:
    modules: dict[str, ModuleInfo] = {}
    if any(lambda_root.glob("*.py")):
        name = config.get("flat_root_module") or config.get("project_slug") or lambda_root.name
        modules[name] = ModuleInfo(name=name, path=lambda_root, flat_root=True)
    for child in lambda_root.iterdir() if lambda_root.exists() else []:
        if child.is_dir() and child.name not in SHARED_NAMES:
            modules[child.name] = ModuleInfo(name=child.name, path=child, flat_root=False)
    return modules


def selected_modules(all_modules: dict[str, ModuleInfo], config: dict[str, Any]) -> list[ModuleInfo]:
    selected = config.get("active_modules", config.get("modules", "*"))
    if selected == "*":
        names = list(all_modules)
    elif isinstance(selected, str):
        names = [selected]
    else:
        names = list(selected)
    missing = [name for name in names if name not in all_modules]
    if missing:
        raise RuntimeError(f"Selected module(s) do not exist: {', '.join(missing)}")
    return [all_modules[name] for name in names]


def module_functions(module: ModuleInfo) -> list[str]:
    return sorted(path.stem for path in module.path.glob("*.py") if not path.name.startswith("_"))


def selected_functions(module: ModuleInfo, config: dict[str, Any]) -> list[str]:
    all_functions = module_functions(module)
    filters = config.get("functions", {}).get(module.name, "*") if isinstance(config.get("functions"), dict) else "*"
    if filters in ("*", None):
        names = all_functions
    elif isinstance(filters, str):
        names = [filters]
    else:
        names = list(filters)
    missing = [name for name in names if name not in all_functions]
    if missing:
        raise RuntimeError(f"Selected function(s) missing in module {module.name}: {', '.join(missing)}")
    return names


def find_module_file(module: ModuleInfo, *names: str) -> Path | None:
    for name in names:
        candidate = module.path / name
        if candidate.exists():
            return candidate
    return None


def parse_lambda_env(module: ModuleInfo) -> dict[str, dict[str, str]]:
    env_path = find_module_file(module, "lambda_env", "lambda.env")
    if not env_path and module.flat_root:
        legacy = module.path.parent / "lambda.env"
        env_path = legacy if legacy.exists() else None
    if not env_path:
        raise RuntimeError(f"Module {module.name} is missing lambda_env")
    parser = configparser.ConfigParser(interpolation=None)
    parser.optionxform = str
    parser.read_string(read_text_resolved(env_path))
    return {section: dict(parser.items(section)) for section in parser.sections()}


def runtime_environment(env_sections: dict[str, dict[str, str]], function: str) -> tuple[dict[str, str], int, int, dict[str, Any] | None]:
    merged = {**env_sections.get("shared", {}), **env_sections.get(function, {})}
    timeout = int(merged.get("LAMBDA_TIMEOUT", "30"))
    memory = int(merged.get("LAMBDA_MEMORY_SIZE", "256"))
    runtime_env = {key: value for key, value in merged.items() if key not in RESERVED_ENV_KEYS}
    vpc_config = None
    if merged.get("DEPLOY_VPC_ENABLED", "false").lower() == "true":
        subnets = [item.strip() for item in merged.get("DEPLOY_SUBNET_IDS", "").split(",") if item.strip()]
        groups = [item.strip() for item in merged.get("DEPLOY_SECURITY_GROUP_IDS", "").split(",") if item.strip()]
        if not subnets or not groups:
            raise RuntimeError("DEPLOY_VPC_ENABLED=true requires DEPLOY_SUBNET_IDS and DEPLOY_SECURITY_GROUP_IDS")
        vpc_config = {"SubnetIds": subnets, "SecurityGroupIds": groups}
    return runtime_env, timeout, memory, vpc_config


def load_permissions(module: ModuleInfo) -> dict[str, Any]:
    path = find_module_file(module, "lambda_permissions.json")
    if not path:
        raise RuntimeError(f"Module {module.name} is missing lambda_permissions.json")
    return resolve_placeholders(json.loads(path.read_text()))


def role_names(config: dict[str, Any], module: ModuleInfo, permissions: dict[str, Any]) -> tuple[str, str]:
    project = config.get("project_name", "DeveloperModeAdmin")
    return (
        permissions.get("role_name") or f"{project}LambdaRole-{module.name}",
        permissions.get("policy_name") or f"{project}LambdaPolicy-{module.name}",
    )


def ensure_role(iam: Any, config: dict[str, Any], module: ModuleInfo) -> str:
    permissions = load_permissions(module)
    role_name, policy_name = role_names(config, module, permissions)
    trust = {
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}],
    }
    changed = False
    try:
        role = iam.get_role(RoleName=role_name)["Role"]
        iam.update_assume_role_policy(RoleName=role_name, PolicyDocument=json.dumps(trust))
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "NoSuchEntity":
            raise
        role = iam.create_role(RoleName=role_name, AssumeRolePolicyDocument=json.dumps(trust))["Role"]
        changed = True

    policy_doc = {"Version": "2012-10-17", "Statement": permissions.get("statements", permissions.get("Statement", []))}
    iam.put_role_policy(RoleName=role_name, PolicyName=policy_name, PolicyDocument=json.dumps(policy_doc))
    for arn in permissions.get("managed_policy_arns", []):
        try:
            iam.attach_role_policy(RoleName=role_name, PolicyArn=arn)
            changed = True
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "EntityAlreadyExists":
                raise
    if changed:
        time.sleep(int(config.get("iam_propagation_wait_seconds", 10)))
    return role["Arn"]


def copy_tree_contents(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    for item in src.iterdir():
        if item.name in SKIP_DIRS:
            continue
        target = dst / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*SKIP_DIRS))
        else:
            shutil.copy2(item, target)


def package_function(lambda_root: Path, module: ModuleInfo, function: str, build_root: Path) -> Path:
    build_dir = build_root / module.name / function
    zip_path = build_root / module.name / f"{function}.zip"
    shutil.rmtree(build_dir, ignore_errors=True)
    zip_path.unlink(missing_ok=True)
    build_dir.mkdir(parents=True, exist_ok=True)

    global_shared = lambda_root / "shared"
    if global_shared.exists() and global_shared != module.path / "shared":
        copy_tree_contents(global_shared, build_dir / "shared")

    for item in module.path.iterdir():
        if item.name in CONFIG_FILES or item.name in SKIP_DIRS:
            continue
        target = build_dir / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*SKIP_DIRS))
        elif item.suffix == ".py" or item.name == "requirements.txt":
            shutil.copy2(item, target)

    requirements = module.path / "requirements.txt"
    if requirements.exists():
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements), "-t", str(build_dir)], check=True)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in build_dir.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(build_dir))
    return zip_path


def lambda_exists(client: Any, function_name: str) -> bool:
    try:
        client.get_function(FunctionName=function_name)
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ResourceNotFoundException":
            return False
        raise


def wait_updated(client: Any, function_name: str) -> None:
    client.get_waiter("function_updated").wait(FunctionName=function_name)


def upsert_alias(client: Any, function_name: str, alias: str, version: str) -> None:
    try:
        current = client.get_alias(FunctionName=function_name, Name=alias)
        if current["FunctionVersion"] != version:
            client.update_alias(FunctionName=function_name, Name=alias, FunctionVersion=version)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        client.create_alias(FunctionName=function_name, Name=alias, FunctionVersion=version)


def deploy_function(client: Any, config: dict[str, Any], role_arn: str, module: ModuleInfo, function: str, zip_path: Path, env: dict[str, str], timeout: int, memory: int, vpc_config: dict[str, Any] | None) -> str:
    function_name = f"{module.name}_{function}"
    handler_name = config.get("handler_name", "lambda_handler")
    handler = config.get("handler") or f"{function}.{handler_name}"
    runtime = config.get("runtime", "python3.12")
    zip_bytes = zip_path.read_bytes()
    if lambda_exists(client, function_name):
        client.update_function_code(FunctionName=function_name, ZipFile=zip_bytes, Publish=False)
        wait_updated(client, function_name)
        client.update_function_configuration(
            FunctionName=function_name,
            Runtime=runtime,
            Role=role_arn,
            Handler=handler,
            Timeout=timeout,
            MemorySize=memory,
            Environment={"Variables": env},
        )
    else:
        client.create_function(
            FunctionName=function_name,
            Runtime=runtime,
            Role=role_arn,
            Handler=handler,
            Code={"ZipFile": zip_bytes},
            Timeout=timeout,
            MemorySize=memory,
            Environment={"Variables": env},
            Publish=False,
        )
    wait_updated(client, function_name)
    if vpc_config:
        client.update_function_configuration(FunctionName=function_name, VpcConfig=vpc_config)
        wait_updated(client, function_name)
    version = client.publish_version(FunctionName=function_name)["Version"]
    alias = config.get("lambda_alias") or config.get("alias")
    if alias:
        upsert_alias(client, function_name, alias, version)
    return version


def load_json_file(module: ModuleInfo, *names: str) -> Any | None:
    path = find_module_file(module, *names)
    if not path:
        return None
    return resolve_placeholders(json.loads(path.read_text()))


def trigger_items(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        return raw.get("triggers") or raw.get("queues") or [raw]
    raise RuntimeError("SQS trigger file must be a list or object")


def queue_arn(sqs: Any, sts: Any, region: str, trigger: dict[str, Any]) -> str:
    arn = trigger.get("arn") or trigger.get("queue_arn")
    if arn:
        return arn
    url = trigger.get("url") or trigger.get("queue_url")
    if not url:
        name = trigger.get("name") or trigger.get("queue_name")
        if not name:
            raise RuntimeError("SQS trigger requires arn, url, or name")
        url = sqs.get_queue_url(QueueName=name)["QueueUrl"]
    attrs = sqs.get_queue_attributes(QueueUrl=url, AttributeNames=["QueueArn"])["Attributes"]
    return attrs.get("QueueArn") or f"arn:aws:sqs:{region}:{sts.get_caller_identity()['Account']}:{url.rsplit('/', 1)[-1]}"


def ensure_sqs_triggers(lambda_client: Any, sqs: Any, sts: Any, region: str, module: ModuleInfo, functions: list[str]) -> None:
    raw = load_json_file(module, "sqs-triggers.json", "sqs_triggers.json")
    for trigger in trigger_items(raw):
        fn = trigger.get("function")
        if fn not in functions:
            raise RuntimeError(f"SQS trigger in {module.name} references unselected or missing function {fn}")
        arn = queue_arn(sqs, sts, region, trigger)
        function_name = f"{module.name}_{fn}"
        batch_size = trigger.get("batch_size", trigger.get("batchSize", 10))
        params = {
            "FunctionName": function_name,
            "EventSourceArn": arn,
            "BatchSize": batch_size,
            "Enabled": trigger.get("enabled", True),
        }
        if "maximum_batching_window_in_seconds" in trigger or "maximumBatchingWindowInSeconds" in trigger:
            params["MaximumBatchingWindowInSeconds"] = trigger.get("maximum_batching_window_in_seconds", trigger.get("maximumBatchingWindowInSeconds"))
        params["FunctionResponseTypes"] = trigger.get("function_response_types", trigger.get("functionResponseTypes", ["ReportBatchItemFailures"]))
        mappings = lambda_client.list_event_source_mappings(FunctionName=function_name, EventSourceArn=arn)["EventSourceMappings"]
        if mappings:
            uuid = mappings[0]["UUID"]
            update = {key: value for key, value in params.items() if key not in {"FunctionName", "EventSourceArn"}}
            lambda_client.update_event_source_mapping(UUID=uuid, **update)
        else:
            lambda_client.create_event_source_mapping(**params)


def preflight(lambda_root: Path, modules: list[ModuleInfo], config: dict[str, Any]) -> dict[str, list[str]]:
    if not lambda_root.exists():
        raise RuntimeError(f"Lambda root does not exist: {lambda_root}")
    selected: dict[str, list[str]] = {}
    for module in modules:
        functions = selected_functions(module, config)
        if not functions:
            raise RuntimeError(f"Module {module.name} has no deployable .py files")
        parse_lambda_env(module)
        load_permissions(module)
        raw_triggers = load_json_file(module, "sqs-triggers.json", "sqs_triggers.json")
        for trigger in trigger_items(raw_triggers):
            if trigger.get("function") not in functions:
                raise RuntimeError(f"SQS trigger in {module.name} references missing or unselected function {trigger.get('function')}")
        selected[module.name] = functions
    return selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deploy-config", default="deploy_config.json")
    parser.add_argument("--lambda-root")
    parser.add_argument("--preflight-only", action="store_true", help="Validate selected modules/functions/config files without calling AWS")
    args = parser.parse_args()

    config_path = Path(args.deploy_config)
    config = load_config(config_path)
    lambda_root = Path(args.lambda_root or config.get("lambda_root", "lambda"))
    if not lambda_root.exists() and lambda_root.name == "lambda" and Path("lambdas").exists():
        lambda_root = Path("lambdas")
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or config.get("region")
    if not region:
        raise RuntimeError("AWS_REGION or AWS_DEFAULT_REGION is required")

    modules = selected_modules(discover_modules(lambda_root, config), config)
    selected = preflight(lambda_root, modules, config)
    print(json.dumps({"lambda_root": str(lambda_root), "modules": selected}, indent=2))
    if args.preflight_only:
        print("preflight-only; no AWS resources changed")
        return

    session = boto3.Session(region_name=region)
    iam = session.client("iam")
    lambda_client = session.client("lambda")
    sqs = session.client("sqs")
    sts = session.client("sts")

    if config.get("deploy_lambdas", True):
        for module in modules:
            role_arn = ensure_role(iam, config, module)
            env_sections = parse_lambda_env(module)
            for function in selected[module.name]:
                env, timeout, memory, vpc_config = runtime_environment(env_sections, function)
                zip_path = package_function(lambda_root, module, function, Path("build/lambdas"))
                version = deploy_function(lambda_client, config, role_arn, module, function, zip_path, env, timeout, memory, vpc_config)
                print(f"deployed {module.name}_{function}:{version}")
    else:
        print("deploy_lambdas=false; skipping Lambda create/update")

    if config.get("deploy_sqs_triggers", False):
        for module in modules:
            ensure_sqs_triggers(lambda_client, sqs, sts, region, module, selected[module.name])
    else:
        print("deploy_sqs_triggers=false; skipping SQS event source mappings")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
