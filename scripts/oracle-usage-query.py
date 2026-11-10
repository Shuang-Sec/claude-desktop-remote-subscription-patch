"""经 SSH 在服务器内执行：只输出额度字段，凭据不离开服务器。"""
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _window(value):
    if not isinstance(value, dict):
        return None
    percent = value.get('utilization')
    reset = value.get('resets_at')
    if isinstance(percent, bool) or not isinstance(percent, (int, float)) or not math.isfinite(percent) or percent < 0:
        return None
    if reset is not None:
        if not isinstance(reset, str):
            return None
        try:
            datetime.fromisoformat(reset.replace('Z', '+00:00'))
        except ValueError:
            return None
    return {'utilization': percent, 'resets_at': reset}


def fetch_usage(oauth, opener=urlopen, sleep=time.sleep):
    token = oauth.get('accessToken')
    if not isinstance(token, str) or not token:
        return {'status': 'error', 'reason': 'missing_credentials'}
    request = Request('https://api.anthropic.com/api/oauth/usage', headers={
        'Authorization': 'Bearer ' + token, 'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-desktop-remote-usage'})
    for attempt in range(2):
        try:
            with opener(request, timeout=10) as response:
                data = json.load(response)
            if not isinstance(data, dict):
                return {'status': 'error', 'reason': 'invalid_response'}
            windows = {key: value for key in ('five_hour', 'seven_day')
                       if (value := _window(data.get(key))) is not None}
            if not windows:
                return {'status': 'error', 'reason': 'invalid_response'}
            subscription = oauth.get('subscriptionType')
            if subscription not in ('pro', 'max', 'team', 'enterprise'):
                subscription = None
            extra = data.get('extra_usage')
            enabled = extra.get('is_enabled') if isinstance(extra, dict) else None
            return {'status': 'ok', 'subscription': subscription,
                    'queried_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                    'windows': windows, 'extra_usage_enabled': enabled if isinstance(enabled, bool) else None}
        except HTTPError as error:
            if error.code in (401, 403):
                return {'status': 'error', 'reason': 'remote_auth'}
            reason = 'rate_limited' if error.code == 429 else 'network'
            if attempt == 0 and (error.code == 429 or error.code >= 500):
                sleep(20 if error.code == 429 else 2)
                continue
            return {'status': 'error', 'reason': reason}
        except (TimeoutError, URLError, OSError):
            if attempt == 0:
                sleep(2)
                continue
            return {'status': 'error', 'reason': 'network'}
        except (ValueError, TypeError):
            return {'status': 'error', 'reason': 'invalid_response'}


def main():
    try:
        credentials = json.loads((Path.home() / '.claude/.credentials.json').read_text())
        oauth = credentials.get('claudeAiOauth', {})
        result = fetch_usage(oauth if isinstance(oauth, dict) else {})
    except (OSError, ValueError, TypeError):
        result = {'status': 'error', 'reason': 'missing_credentials'}
    except Exception:
        # 不输出 traceback 或服务器响应，避免异常包含认证材料。
        result = {'status': 'error', 'reason': 'network'}
    print(json.dumps(result, ensure_ascii=True, allow_nan=False))


if __name__ == '__main__':
    main()
