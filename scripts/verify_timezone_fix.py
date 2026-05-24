#!/usr/bin/env python3
import sys
import time
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import HOST, PASSWORD, REMOTE_DIR, USER, run

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
run(
    ssh,
    f"cd {REMOTE_DIR} && pm2 delete med-next-pwa 2>/dev/null; "
    "pm2 start ecosystem.config.cjs && pm2 save",
    check=False,
)
time.sleep(3)
cron_cmd = (
    f"bash -lc 'set -a && . {REMOTE_DIR}/.env.local && set +a && "
    'curl -fsS -H "Authorization: Bearer $CRON_SECRET" '
    "http://127.0.0.1:3007/api/cron/check-reminders'"
)
run(ssh, cron_cmd, check=False)
run(ssh, "pm2 env med-next-pwa 2>/dev/null | grep -E 'TZ|APP_TIMEZONE' || true", check=False)
ssh.close()
