#!/usr/bin/env python3
"""Remove mistaken Next.js deploy from DB server; keep MySQL medtracker."""
import paramiko

HOST = "192.168.1.14"
PW = "kerkpoort"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PW, timeout=15)

def run(cmd: str) -> str:
    print("$", cmd)
    _, o, _ = ssh.exec_command(cmd)
    out = o.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out.strip())
    return out

print("=== Before ===")
run("pm2 list")
run("du -sh /var/www/med-track-pwa 2>/dev/null || echo no folder")
run("mysql -uroot -pkerkpoort medtracker -e 'SHOW TABLES;'")

print("\n=== Cleanup (app only, DB stays) ===")
run("pm2 delete med-track-pwa 2>/dev/null; true")
run("pm2 save 2>/dev/null; true")
run("rm -rf /var/www/med-track-pwa")

print("\n=== After ===")
run("ls -la /var/www/")
run("pm2 list")
run("mysql -uroot -pkerkpoort medtracker -e 'SHOW TABLES;'")

ssh.close()
print("\nDone: Next.js removed from .14, MySQL medtracker unchanged.")
