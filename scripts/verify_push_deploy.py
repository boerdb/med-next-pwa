#!/usr/bin/env python3
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).parent))
from deploy_remote import HOST, PASSWORD, REMOTE_DIR, USER, run

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
run(ssh, "ss -tlnp | grep 3007 || true", check=False)
run(
    ssh,
    f"bash -lc 'set -a && . {REMOTE_DIR}/.env.local && set +a && "
    f'curl -fsS -H "Authorization: Bearer $CRON_SECRET" '
    f'http://127.0.0.1:3007/api/cron/check-reminders\'',
    check=False,
)
run(ssh, "pm2 describe med-next-pwa | head -25", check=False)
ssh.close()
