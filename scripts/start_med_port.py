#!/usr/bin/env python3
import paramiko
from pathlib import Path

REMOTE = "/var/www/med-next-pwa"
PORT = "3007"
PROJECT = Path(__file__).resolve().parent.parent

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("192.168.1.32", username="root", password="kerkpoort", timeout=30)
sftp = ssh.open_sftp()
sftp.put(str(PROJECT / "ecosystem.config.cjs"), f"{REMOTE}/ecosystem.config.cjs")
sftp.close()

env = f"""DATABASE_URL=mysql://medtracker:kerkpoort@192.168.1.14:3306/medtracker
SESSION_SECRET=placeholder
NODE_ENV=production
PORT={PORT}
"""
# preserve SESSION_SECRET if exists
_, o, _ = ssh.exec_command(f"grep SESSION_SECRET {REMOTE}/.env.local 2>/dev/null")
secret_line = o.read().decode().strip()
if secret_line.startswith("SESSION_SECRET="):
    env = env.replace("SESSION_SECRET=placeholder", secret_line)

with ssh.open_sftp().file(f"{REMOTE}/.env.local", "w") as f:
    f.write(env)

for c in [
    f"cd {REMOTE} && pm2 delete med-track-pwa 2>/dev/null; true",
    f"cd {REMOTE} && pm2 start ecosystem.config.cjs",
    "pm2 save",
    f"sleep 4 && curl -s http://127.0.0.1:{PORT}/api/auth/me",
    f"pm2 logs med-track-pwa --lines 5 --nostream 2>&1 | tail -12",
]:
    print("$", c)
    _, o, _ = ssh.exec_command(c, timeout=90)
    print(o.read().decode("utf-8", errors="replace")[-800:])
ssh.close()
