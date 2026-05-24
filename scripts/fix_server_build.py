#!/usr/bin/env python3
import paramiko

REMOTE = "/var/www/med-next-pwa"
HOST = "192.168.1.32"
PW = "kerkpoort"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PW, timeout=30)

def run(cmd: str, timeout: int = 300) -> str:
    print("$", cmd[:80])
    _, o, _ = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    print(out[-3000:] if len(out) > 3000 else out)
    if code != 0:
        print(f"exit {code}")
    return out

run(f"ls -la {REMOTE}/.env.example {REMOTE}/env.example {REMOTE}/.env.local")
run(
    f"rm -f {REMOTE}/hooks/useInstantData.ts {REMOTE}/instant.perms.ts "
    f"{REMOTE}/lib/db/instant.ts {REMOTE}/lib/db/schema.ts"
)
run(f"cd {REMOTE} && npm run build")
run("ss -tlnp | grep node | head -15")
run(f"pm2 delete med-next-pwa 2>/dev/null; pm2 delete med-track-pwa 2>/dev/null; cd {REMOTE} && pm2 start ecosystem.config.cjs")
run("pm2 save")
run("sleep 2 && curl -s http://127.0.0.1:3010/api/auth/me")
ssh.close()
print("Done")
