#!/usr/bin/env python3
import sys
from pathlib import Path

import paramiko
from homelab import ssh_connect

sys.path.insert(0, str(Path(__file__).parent))
from deploy_remote import HOST, REMOTE_DIR, USER, run

ssh = ssh_connect(HOST, USER)
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
