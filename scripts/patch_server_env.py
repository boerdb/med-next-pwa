#!/usr/bin/env python3
"""Add APP_TIMEZONE to server .env.local if missing."""
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import HOST, PASSWORD, REMOTE_DIR, USER, run

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
run(
    ssh,
    f"grep -q '^APP_TIMEZONE=' {REMOTE_DIR}/.env.local || "
    f"echo 'APP_TIMEZONE=Europe/Amsterdam' >> {REMOTE_DIR}/.env.local",
    check=False,
)
run(ssh, f"grep APP_TIMEZONE {REMOTE_DIR}/.env.local", check=False)
ssh.close()
print("Done")
