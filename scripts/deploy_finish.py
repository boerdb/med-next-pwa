#!/usr/bin/env python3
"""Continue deploy: Node install + build + PM2 (files already on server)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from deploy_remote import HOST, PASSWORD, REMOTE_DIR, USER, run
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

code, _, _ = run(ssh, "node -v", check=False)
if code != 0:
    print("Installing Node.js 22...")
    run(ssh, "apt-get update -qq", timeout=600)
    run(ssh, "apt-get install -y -qq ca-certificates curl gnupg", timeout=600)
    run(ssh, "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -", timeout=600)
    run(ssh, "apt-get install -y -qq nodejs", timeout=600)

run(ssh, "node -v && npm -v")
run(ssh, f"cd {REMOTE_DIR} && npm ci", timeout=600)
run(ssh, f"cd {REMOTE_DIR} && npm run build", timeout=600)
run(ssh, "npm install -g pm2", check=False)
run(ssh, "pm2 delete med-next-pwa 2>/dev/null; pm2 delete med-track-pwa 2>/dev/null; true", check=False)
run(ssh, f"cd {REMOTE_DIR} && pm2 start ecosystem.config.cjs && pm2 save")
run(ssh, "pm2 startup systemd -u root --hp /root 2>/dev/null | grep -v PM2 | bash", check=False)
run(ssh, "pm2 list", check=False)
run(ssh, "mysql -uroot -pkerkpoort medtracker -e 'SHOW TABLES;'", check=False)
ssh.close()
print("Finish deploy OK")
