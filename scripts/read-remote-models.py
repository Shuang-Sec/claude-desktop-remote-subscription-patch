"""只进行官方引擎初始化，读取可选模型，不发送用户消息或模型推理请求。"""
import argparse
import json
import os
import re
import selectors
import subprocess
import time
import uuid
from pathlib import Path


def discover_desktop_cli(home):
    base = home / '.claude/remote/ccd-cli'
    if not base.is_dir():
        return None
    candidates = []
    for item in base.iterdir():
        if not item.is_file():
            continue
        match = re.match(r'^(\d+)\.(\d+)\.(\d+)', item.name)
        if not match:
            continue
        candidates.append(((int(match.group(1)), int(match.group(2)), int(match.group(3)), item.stat().st_mtime), item))
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


def initialize(binary, entrypoint, test_cwd, timeout):
    env = os.environ.copy()
    env['CLAUDE_CODE_ENTRYPOINT'] = entrypoint
    process = subprocess.Popen(
        [str(binary), '--print', '--input-format', 'stream-json',
         '--output-format', 'stream-json', '--verbose', '--no-session-persistence'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        text=True, env=env, cwd=test_cwd)
    request_id = str(uuid.uuid4())
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    try:
        process.stdin.write(json.dumps({
            'type': 'control_request', 'request_id': request_id,
            'request': {'subtype': 'initialize', 'hooks': {}, 'sdkMcpServers': []}
        }) + '\n')
        process.stdin.flush()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline and process.poll() is None:
            if not selector.select(1):
                continue
            line = process.stdout.readline()
            if not line:
                break
            try:
                message = json.loads(line)
            except ValueError:
                continue
            response = message.get('response', {})
            if message.get('type') == 'control_response' and response.get('request_id') == request_id:
                body = response.get('response', {})
                found = {
                    'binary': str(binary), 'entrypoint': entrypoint, 'status': response.get('subtype'),
                    'version': body.get('claude_code_version'), 'models': body.get('models', [])
                }
                if found['status'] != 'success' or not found['models']:
                    raise SystemExit(f'{entrypoint} 初始化失败；未输出或修改认证信息。')
                return found
        raise SystemExit(f'{entrypoint} 初始化超时；未输出或修改认证信息。')
    finally:
        selector.close()
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main():
    parser = argparse.ArgumentParser(description='只读读取远端 Claude Code 初始化模型目录')
    parser.add_argument('--vscode-bin', default=str(Path.home() / '.local/bin/claude'))
    parser.add_argument('--desktop-cli', default='')
    parser.add_argument('--test-cwd', default=str(Path.home()))
    parser.add_argument('--timeout', type=float, default=20)
    args = parser.parse_args()

    test_cwd = Path(args.test_cwd)
    if not test_cwd.is_dir():
        raise SystemExit(f'测试目录不存在：{test_cwd}')
    vscode = Path(args.vscode_bin)
    if not vscode.is_file():
        raise SystemExit(f'找不到 Claude Code CLI：{vscode}')
    desktop = Path(args.desktop_cli) if args.desktop_cli else discover_desktop_cli(Path.home())
    if desktop is None or not desktop.is_file():
        raise SystemExit('找不到 Desktop 配套引擎（~/.claude/remote/ccd-cli/*）')

    result = [
        initialize(vscode, 'claude-vscode', test_cwd, args.timeout),
        initialize(desktop, 'claude-desktop', test_cwd, args.timeout)
    ]
    print(json.dumps(result, ensure_ascii=True))


if __name__ == '__main__':
    main()
