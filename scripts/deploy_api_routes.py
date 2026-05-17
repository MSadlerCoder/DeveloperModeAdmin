#!/usr/bin/env python3
"""Deploy HTTP API Gateway v2 routes for repository Lambda handlers."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError

PLACEHOLDER_RE = re.compile(r"\[([A-Z0-9_]+)\]")
SHARED_NAMES = {"shared", "common", "__pycache__", ".pytest_cache"}


@dataclass(frozen=True)
class ModuleInfo:
    name: str
    path: Path
    flat_root: bool


def load_config(path: Path) -> dict[str, Any]:
    with path.open() as fh:
        raw = json.load(fh)
    return resolve_placeholders({**raw, **raw.get("deploy", {})})


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


def discover_modules(lambda_root: Path, config: dict[str, Any]) -> dict[str, ModuleInfo]:
    modules: dict[str, ModuleInfo] = {}
    if any(lambda_root.glob("*.py")):
        modules[config.get("flat_root_module") or config.get("project_slug") or lambda_root.name] = ModuleInfo(
            config.get("flat_root_module") or config.get("project_slug") or lambda_root.name, lambda_root, True
        )
    for child in lambda_root.iterdir() if lambda_root.exists() else []:
        if child.is_dir() and child.name not in SHARED_NAMES:
            modules[child.name] = ModuleInfo(child.name, child, False)
    return modules


def selected_modules(all_modules: dict[str, ModuleInfo], config: dict[str, Any]) -> list[ModuleInfo]:
    selected = config.get("active_modules", config.get("modules", "*"))
    names = list(all_modules) if selected == "*" else ([selected] if isinstance(selected, str) else list(selected))
    missing = [name for name in names if name not in all_modules]
    if missing:
        raise RuntimeError(f"Selected module(s) do not exist: {', '.join(missing)}")
    return [all_modules[name] for name in names]


def selected_functions(module: ModuleInfo, config: dict[str, Any]) -> list[str]:
    all_functions = sorted(path.stem for path in module.path.glob("*.py") if not path.name.startswith("_"))
    filters = config.get("functions", {}).get(module.name, "*") if isinstance(config.get("functions"), dict) else "*"
    names = all_functions if filters in ("*", None) else ([filters] if isinstance(filters, str) else list(filters))
    missing = [name for name in names if name not in all_functions]
    if missing:
        raise RuntimeError(f"Selected function(s) missing in module {module.name}: {', '.join(missing)}")
    return names


def find_module_file(module: ModuleInfo, *names: str) -> Path | None:
    for name in names:
        path = module.path / name
        if path.exists():
            return path
    return None


def load_routes(module: ModuleInfo) -> list[dict[str, Any]]:
    path = find_module_file(module, "api-routes.json", "api_routes.json")
    if not path:
        return []
    raw = resolve_placeholders(json.loads(path.read_text()))
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        return raw.get("routes", [])
    raise RuntimeError(f"Route file for {module.name} must be a list or object with routes")


def route_key(route: dict[str, Any]) -> str:
    key = route.get("route_key") or route.get("routeKey")
    if key:
        return key.strip()
    method = route.get("method")
    path = route.get("path")
    if not method or not path:
        raise RuntimeError("Route requires route_key/routeKey or method + path")
    return f"{method.upper()} {path}"


def get_account_id(sts: Any) -> str:
    return os.environ.get("AWS_ACCOUNT_ID") or sts.get_caller_identity()["Account"]


def ensure_stage(api: Any, api_id: str, stage: str, variable: str, alias: str) -> None:
    variables = {variable: alias}
    try:
        current = api.get_stage(ApiId=api_id, StageName=stage)
        merged = {**current.get("StageVariables", {}), **variables}
        api.update_stage(ApiId=api_id, StageName=stage, StageVariables=merged, AutoDeploy=current.get("AutoDeploy", True))
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "NotFoundException":
            raise
        api.create_stage(ApiId=api_id, StageName=stage, StageVariables=variables, AutoDeploy=True)


def existing_integrations(api: Any, api_id: str) -> dict[str, dict[str, Any]]:
    items: list[dict[str, Any]] = []
    token = None
    while True:
        params = {"ApiId": api_id}
        if token:
            params["NextToken"] = token
        page = api.get_integrations(**params)
        items.extend(page.get("Items", []))
        token = page.get("NextToken")
        if not token:
            break
    return {item.get("IntegrationUri", ""): item for item in items}


def existing_routes(api: Any, api_id: str) -> dict[str, dict[str, Any]]:
    items: list[dict[str, Any]] = []
    token = None
    while True:
        params = {"ApiId": api_id}
        if token:
            params["NextToken"] = token
        page = api.get_routes(**params)
        items.extend(page.get("Items", []))
        token = page.get("NextToken")
        if not token:
            break
    return {item["RouteKey"]: item for item in items}


def ensure_integration(api: Any, api_id: str, integrations: dict[str, dict[str, Any]], uri: str) -> str:
    existing = integrations.get(uri)
    params = {
        "ApiId": api_id,
        "IntegrationType": "AWS_PROXY",
        "IntegrationUri": uri,
        "PayloadFormatVersion": "2.0",
        "IntegrationMethod": "POST",
    }
    if existing:
        api.update_integration(IntegrationId=existing["IntegrationId"], **params)
        return existing["IntegrationId"]
    return api.create_integration(**params)["IntegrationId"]


def ensure_route(api: Any, api_id: str, routes: dict[str, dict[str, Any]], key: str, integration_id: str, route: dict[str, Any], config: dict[str, Any]) -> None:
    target = f"integrations/{integration_id}"
    kwargs: dict[str, Any] = {"ApiId": api_id, "RouteKey": key, "Target": target}
    if route.get("auth"):
        authorizer = route.get("authorizer_id") or route.get("authorizerId") or config.get("default_authorizer_id")
        if not authorizer:
            raise RuntimeError(f"Route {key} has auth=true but no authorizer id is configured")
        kwargs["AuthorizationType"] = route.get("authorization_type") or route.get("authorizationType") or config.get("default_authorization_type", "JWT")
        kwargs["AuthorizerId"] = authorizer
    else:
        kwargs["AuthorizationType"] = route.get("authorization_type") or route.get("authorizationType") or "NONE"
    if key in routes:
        update = {k: v for k, v in kwargs.items() if k not in {"RouteKey"}}
        api.update_route(RouteId=routes[key]["RouteId"], **update)
    else:
        api.create_route(**kwargs)


def ensure_lambda_permission(lambda_client: Any, function_name: str, alias: str, statement_id: str, source_arn: str) -> None:
    try:
        lambda_client.add_permission(
            FunctionName=function_name,
            Qualifier=alias,
            StatementId=statement_id,
            Action="lambda:InvokeFunction",
            Principal="apigateway.amazonaws.com",
            SourceArn=source_arn,
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceConflictException":
            raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lambda-root")
    parser.add_argument("--api-id", default=os.environ.get("API_GATEWAY_ID"))
    parser.add_argument("--stage", required=True)
    parser.add_argument("--lambda-alias", required=True)
    parser.add_argument("--stage-variable-name", default="lambdaAlias")
    parser.add_argument("--region", default=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"))
    parser.add_argument("--deploy-config", default="deploy_config.json")
    args = parser.parse_args()

    if not args.api_id:
        raise RuntimeError("--api-id or API_GATEWAY_ID is required")
    if not args.region:
        raise RuntimeError("--region or AWS_REGION is required")

    config = load_config(Path(args.deploy_config))
    if not config.get("deploy_api_routes", True):
        print("deploy_api_routes=false; skipping API route deployment")
        return
    lambda_root = Path(args.lambda_root or config.get("lambda_root", "lambda"))
    if not lambda_root.exists() and lambda_root.name == "lambda" and Path("lambdas").exists():
        lambda_root = Path("lambdas")
    modules = selected_modules(discover_modules(lambda_root, config), config)
    selected = {module.name: selected_functions(module, config) for module in modules}

    session = boto3.Session(region_name=args.region)
    api = session.client("apigatewayv2")
    lambda_client = session.client("lambda")
    sts = session.client("sts")
    account_id = get_account_id(sts)
    ensure_stage(api, args.api_id, args.stage, args.stage_variable_name, args.lambda_alias)
    integrations = existing_integrations(api, args.api_id)
    routes = existing_routes(api, args.api_id)

    for module in modules:
        for route in load_routes(module):
            function = route.get("function")
            if function not in selected[module.name]:
                raise RuntimeError(f"Route in {module.name} references missing or unselected function {function}")
            key = route_key(route)
            function_name = f"{module.name}_{function}"
            uri = f"arn:aws:lambda:{args.region}:{account_id}:function:{function_name}:${{stageVariables.{args.stage_variable_name}}}"
            integration_id = ensure_integration(api, args.api_id, integrations, uri)
            ensure_route(api, args.api_id, routes, key, integration_id, route, config)
            method, route_path = key.split(" ", 1) if " " in key else ("*", key)
            source_arn = f"arn:aws:execute-api:{args.region}:{account_id}:{args.api_id}/*/{method}{route_path}"
            statement_id = f"apigw-{args.api_id}-{args.stage}-{module.name}-{function}-{abs(hash(key))}"[:100]
            ensure_lambda_permission(lambda_client, function_name, args.lambda_alias, statement_id, source_arn)
            print(f"deployed route {key} -> {function_name}:${{{args.stage_variable_name}}}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
