#!/usr/bin/env python3
"""Deploy push notifications: code, SQL, VAPID/cron env, build, PM2, crontab."""
from __future__ import annotations

import os
import re
import secrets
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import (  # noqa: E402
    DB_HOST,
    HOST,
    PASSWORD,
    PROJECT_ROOT,
    REMOTE_DIR,
    SKIP_DIRS,
    SKIP_FILES,
    USER,
    run,
)

DB_SSH_HOST = os.environ.get("DB_SSH_HOST", "192.168.1.14")
CRON_URL = "http://127.0.0.1:3007/api/cron/check-reminders"
CRON_LINE_PREFIX = "med-next-pwa-reminders"


def generate_vapid() -> tuple[str, str]:
    out = subprocess.check_output(
        ["npx", "web-push", "generate-vapid-keys"],
        cwd=PROJECT_ROOT,
        text=True,
        shell=os.name == "nt",
    )
    public = private = ""
    lines = [
        ln.strip()
        for ln in out.splitlines()
        if ln.strip() and not ln.strip().startswith("=")
    ]
    for i, line in enumerate(lines):
        low = line.lower()
        if "public key" in low:
            after = line.split(":", 1)[1].strip() if ":" in line else ""
            public = after or (lines[i + 1] if i + 1 < len(lines) else "")
        if "private key" in low:
            after = line.split(":", 1)[1].strip() if ":" in line else ""
            private = after or (lines[i + 1] if i + 1 < len(lines) else "")
    if not public or not private:
        raise RuntimeError(f"Could not parse VAPID keys:\n{out}")
    return public, private


def parse_env(text: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


def env_to_text(env: dict[str, str]) -> str:
    order = [
        "DATABASE_URL",
        "SESSION_SECRET",
        "NODE_ENV",
        "PORT",
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
        "VAPID_PRIVATE_KEY",
        "VAPID_SUBJECT",
        "CRON_SECRET",
    ]
    lines: list[str] = []
    seen: set[str] = set()
    for key in order:
        if key in env:
            lines.append(f"{key}={env[key]}")
            seen.add(key)
    for key, val in sorted(env.items()):
        if key not in seen:
            lines.append(f"{key}={val}")
    return "\n".join(lines) + "\n"


def upload_project(ssh: paramiko.SSHClient) -> None:
    tar_path = tempfile.mktemp(suffix=".tar.gz")
    try:
        with tarfile.open(tar_path, "w:gz") as tar:
            for path in PROJECT_ROOT.rglob("*"):
                rel = path.relative_to(PROJECT_ROOT)
                if rel.parts and rel.parts[0] in SKIP_DIRS:
                    continue
                if any(p in SKIP_DIRS for p in rel.parts):
                    continue
                if path.name in SKIP_FILES:
                    continue
                if path.is_file():
                    tar.add(path, arcname=str(rel).replace("\\", "/"))

        sftp = ssh.open_sftp()
        remote_tar = "/tmp/med-track-deploy.tar.gz"
        print(f"Uploading {os.path.getsize(tar_path) // 1024} KB...")
        sftp.put(tar_path, remote_tar)
        sftp.close()
        run(ssh, f"mkdir -p {REMOTE_DIR}")
        run(ssh, f"tar -xzf {remote_tar} -C {REMOTE_DIR}")
        run(ssh, f"rm -f {remote_tar}")
    finally:
        if os.path.exists(tar_path):
            os.unlink(tar_path)


def run_mysql_push_tables(ssh_db: paramiko.SSHClient) -> None:
    sql = (PROJECT_ROOT / "sql" / "push-tables.sql").read_text(encoding="utf-8")
    sftp = ssh_db.open_sftp()
    with sftp.file("/tmp/medtracker-push-tables.sql", "w") as f:
        f.write(sql)
    sftp.close()
    run(
        ssh_db,
        "mysql -uroot -pkerkpoort < /tmp/medtracker-push-tables.sql",
        check=False,
    )
    run(
        ssh_db,
        "mysql -uroot -pkerkpoort medtracker -e \"SHOW TABLES LIKE 'push_%';\"",
        check=False,
    )


def merge_env_local(ssh: paramiko.SSHClient) -> None:
    _, out, _ = run(ssh, f"cat {REMOTE_DIR}/.env.local 2>/dev/null || true", check=False)
    env = parse_env(out)
    if not env.get("DATABASE_URL"):
        env["DATABASE_URL"] = f"mysql://medtracker:kerkpoort@{DB_HOST}:3306/medtracker"
    if not env.get("SESSION_SECRET"):
        env["SESSION_SECRET"] = secrets.token_urlsafe(32)
    env.setdefault("NODE_ENV", "production")
    env.setdefault("VAPID_SUBJECT", "mailto:med@clvs.nl")

    if not env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") or not env.get("VAPID_PRIVATE_KEY"):
        print("Generating VAPID keys...")
        pub, priv = generate_vapid()
        env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] = pub
        env["VAPID_PRIVATE_KEY"] = priv
        print(f"VAPID public: {pub[:24]}...")
    else:
        print("Keeping existing VAPID keys")

    if not env.get("CRON_SECRET"):
        env["CRON_SECRET"] = secrets.token_hex(32)
        print("Generated new CRON_SECRET")

    content = env_to_text(env)
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/.env.local", "w") as f:
        f.write(content)
    sftp.close()
    return env.get("CRON_SECRET", "")


def setup_crontab(ssh: paramiko.SSHClient, cron_secret: str) -> None:
    cron_cmd = (
        f'curl -fsS -H "Authorization: Bearer {cron_secret}" "{CRON_URL}" >/dev/null 2>&1'
    )
    marker = CRON_LINE_PREFIX
    run(ssh, "crontab -l 2>/dev/null > /tmp/crontab.bak || true", check=False)
    _, out, _ = run(ssh, "crontab -l 2>/dev/null || true", check=False)
    lines = [ln for ln in out.splitlines() if marker not in ln and "check-reminders" not in ln]
    lines.append(f"* * * * * {cron_cmd} # {marker}")
    new_crontab = "\n".join(lines) + "\n"
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/medtracker-crontab", "w") as f:
        f.write(new_crontab)
    sftp.close()
    run(ssh, "crontab /tmp/medtracker-crontab && rm -f /tmp/medtracker-crontab")
    run(ssh, "crontab -l | grep -F check-reminders || true", check=False)


def build_and_restart(ssh: paramiko.SSHClient) -> None:
    run(ssh, f"cd {REMOTE_DIR} && npm ci", timeout=600)
    run(ssh, f"cd {REMOTE_DIR} && npm run build", timeout=600)
    run(ssh, "pm2 delete med-next-pwa 2>/dev/null; true", check=False)
    run(ssh, f"cd {REMOTE_DIR} && pm2 start ecosystem.config.cjs && pm2 save")
    run(ssh, "pm2 restart med-next-pwa 2>/dev/null || true", check=False)
    run(ssh, "pm2 list", check=False)
    run(
        ssh,
        f'bash -lc \'set -a; source {REMOTE_DIR}/.env.local; set +a; '
        f'curl -fsS -H "Authorization: Bearer $CRON_SECRET" "{CRON_URL}"\'',
        check=False,
    )


def main() -> None:
    ssh_app = paramiko.SSHClient()
    ssh_app.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting app server {USER}@{HOST}...")
    ssh_app.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    ssh_db = paramiko.SSHClient()
    ssh_db.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting DB server {USER}@{DB_SSH_HOST}...")
    ssh_db.connect(DB_SSH_HOST, username=USER, password=PASSWORD, timeout=30)

    upload_project(ssh_app)
    run_mysql_push_tables(ssh_db)
    cron_secret = merge_env_local(ssh_app)
    build_and_restart(ssh_app)
    setup_crontab(ssh_app, cron_secret)

    ssh_db.close()
    ssh_app.close()
    print("\n=== Push deploy complete ===")
    print(f"App: https://med.clvs.nl (poort 3007)")
    print("Zet meldingen aan via bel-icoon op Vandaag.")


if __name__ == "__main__":
    main()
