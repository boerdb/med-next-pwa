#!/usr/bin/env python3
import paramiko
from pathlib import Path

REMOTE = "/var/www/med-next-pwa"
HOST = "192.168.1.32"
PW = "kerkpoort"
PROJECT = Path(__file__).resolve().parent.parent

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PW, timeout=30)
sftp = ssh.open_sftp()
sftp.put(str(PROJECT / "ecosystem.config.cjs"), f"{REMOTE}/ecosystem.config.cjs")

# PORT in .env.local
_, o, _ = ssh.exec_command(f"grep -q '^PORT=' {REMOTE}/.env.local 2>/dev/null && echo hasport || echo noport")
if "hasport" not in o.read().decode():
    ssh.exec_command(f"echo 'PORT=3010' >> {REMOTE}/.env.local")

cmds = [
    f"cd {REMOTE} && pm2 delete med-next-pwa 2>/dev/null; pm2 delete med-track-pwa 2>/dev/null; true",
    f"cd {REMOTE} && pm2 start ecosystem.config.cjs",
    "pm2 save",
    "sleep 3 && pm2 logs med-next-pwa --lines 8 --nostream",
    "curl -s http://127.0.0.1:3010/api/auth/me",
]
for c in cmds:
    print("$", c)
    _, o, _ = ssh.exec_command(c, timeout=60)
    print(o.read().decode("utf-8", errors="replace")[-1500:])
sftp.close()
ssh.close()
