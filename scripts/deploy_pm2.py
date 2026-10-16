#!/usr/bin/env python3
import paramiko
from homelab import mysql_root, ssh_connect
from deploy_remote import HOST, REMOTE_DIR, USER, run

ssh = ssh_connect(HOST, USER)
run(ssh, "npm install -g pm2", check=False)
run(ssh, "pm2 delete med-next-pwa 2>/dev/null; pm2 delete med-track-pwa 2>/dev/null; true", check=False)
run(ssh, f"cd {REMOTE_DIR} && pm2 start ecosystem.config.cjs")
run(ssh, "pm2 save")
run(ssh, "sleep 2 && pm2 list", check=False)
run(ssh, "curl -s http://127.0.0.1:3000/api/auth/me", check=False)
run(ssh, f"{mysql_root()} medtracker -e 'SHOW TABLES;'", check=False)
ssh.close()
print("PM2 OK")
