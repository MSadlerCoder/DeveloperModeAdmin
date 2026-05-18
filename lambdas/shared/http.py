import json
from typing import Any, Dict, Optional

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
}


def response(status_code: int, body: Any = None, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    merged = {**HEADERS, **(headers or {})}
    return {
        'statusCode': status_code,
        'headers': merged,
        'body': '' if body is None else json.dumps(body),
    }
