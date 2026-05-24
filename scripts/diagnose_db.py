#!/usr/bin/env python3
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import HOST, PASSWORD, REMOTE_DIR, USER, run

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("192.168.1.14", username=USER, password=PASSWORD, timeout=30)
run(
    ssh,
    "mysql -uroot -pkerkpoort medtracker -e "
    "'SELECT name, times FROM medications; "
    "SELECT endpoint_hash, user_id FROM push_subscriptions; "
    "SELECT slot_key, first_sent, second_sent FROM push_reminder_flags ORDER BY slot_key DESC LIMIT 15;'",
    check=False,
)
ssh.close()

ssh2 = paramiko.SSHClient()
ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh2.connect(HOST, username=USER, password=PASSWORD, timeout=30)
run(ssh2, f"grep -E 'VAPID|TZ' {REMOTE_DIR}/.env.local | sed 's/=.*$/=***/'", check=False)
ssh2.close()
