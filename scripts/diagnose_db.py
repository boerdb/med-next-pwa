#!/usr/bin/env python3
import sys
from pathlib import Path

import paramiko
from homelab import mysql_root, ssh_connect

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import HOST, REMOTE_DIR, USER, run

ssh = ssh_connect("192.168.1.14", USER)
run(
    ssh,
    f"{mysql_root()} medtracker -e "
    "'SELECT name, times FROM medications; "
    "SELECT endpoint_hash, user_id FROM push_subscriptions; "
    "SELECT slot_key, first_sent, second_sent FROM push_reminder_flags ORDER BY slot_key DESC LIMIT 15;'",
    check=False,
)
ssh.close()

ssh2 = ssh_connect(HOST, USER)
run(ssh2, f"grep -E 'VAPID|TZ' {REMOTE_DIR}/.env.local | sed 's/=.*$/=***/'", check=False)
ssh2.close()
