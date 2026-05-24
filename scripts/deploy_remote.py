#!/usr/bin/env python3
"""Deploy MedTracker to server via SSH/SFTP."""
import os
import secrets
import stat
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "192.168.1.32")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "kerkpoort")
REMOTE_DIR = os.environ.get("DEPLOY_DIR", "/var/www/med-next-pwa")
# MySQL on DB-server (192.168.1.14)
DB_HOST = os.environ.get("DB_HOST", "192.168.1.14")
PROJECT_ROOT = Path(__file__).resolve().parent.parent

SKIP_DIRS = {
    "node_modules",
    ".next",
    ".git",
    ".cursor",
    "__pycache__",
}
SKIP_FILES = {".env.local", ".env"}


def run(
    ssh: paramiko.SSHClient,
    cmd: str,
    check: bool = True,
    timeout: int = 600,
) -> tuple[int, str, str]:
    print(f"$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip() and code != 0:
        print(err.rstrip(), file=sys.stderr)
    if check and code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}\n{err}")
    return code, out, err


def upload_project(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tar_path = tmp.name
    try:
        with tarfile.open(tar_path, "w:gz") as tar:
            for path in PROJECT_ROOT.rglob("*"):
                rel = path.relative_to(PROJECT_ROOT)
                parts = rel.parts
                if parts and parts[0] in SKIP_DIRS:
                    continue
                if any(p in SKIP_DIRS for p in parts):
                    continue
                if path.name in SKIP_FILES:
                    continue
                if path.is_file():
                    tar.add(path, arcname=str(rel).replace("\\", "/"))
        remote_tar = f"/tmp/med-track-deploy.tar.gz"
        sftp.put(tar_path, remote_tar)
        run(
            sftp.get_channel().get_transport().open_session().get_transport().open_channel("session")
            if False
            else None,
            "",
        )
    finally:
        os.unlink(tar_path)

    # extract via ssh instead
    ssh = sftp.get_channel().get_transport().open_channel("session")
    # use parent ssh from caller - refactor


def main() -> None:
    session_secret = secrets.token_urlsafe(32)
    env_content = f"""DATABASE_URL=mysql://medtracker:kerkpoort@{DB_HOST}:3306/medtracker
SESSION_SECRET={session_secret}
NODE_ENV=production
"""

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(ssh, "mkdir -p /var/www")
    run(ssh, f"mkdir -p {REMOTE_DIR}")

    # Upload tarball
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
        run(ssh, f"tar -xzf {remote_tar} -C {REMOTE_DIR}")
        run(ssh, f"rm -f {remote_tar}")
        sftp.close()
    finally:
        if os.path.exists(tar_path):
            os.unlink(tar_path)

    # MySQL schema
    schema = (PROJECT_ROOT / "sql" / "schema.sql").read_text(encoding="utf-8")
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/medtracker-schema.sql", "w") as f:
        f.write(schema)
    sftp.close()

    # Schema/users only on DB server when Next and MySQL are split
    if HOST == DB_HOST or DB_HOST in ("127.0.0.1", "localhost"):
        run(ssh, "mysql -u root -pkerkpoort < /tmp/medtracker-schema.sql 2>/dev/null || mysql -uroot -pkerkpoort < /tmp/medtracker-schema.sql")
        run(
            ssh,
            """mysql -uroot -pkerkpoort -e "
CREATE USER IF NOT EXISTS 'medtracker'@'localhost' IDENTIFIED BY 'kerkpoort';
GRANT SELECT, INSERT, UPDATE, DELETE ON medtracker.* TO 'medtracker'@'localhost';
FLUSH PRIVILEGES;
" """,
            check=False,
        )
    else:
        print(f"Skipping MySQL schema on {HOST} (database on {DB_HOST})")

    # .env.local
    run(
        ssh,
        f"cat > {REMOTE_DIR}/.env.local << 'ENVEOF'\n{env_content}ENVEOF",
    )

    # Node.js (install if missing)
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

    _, out, _ = run(ssh, "pm2 list", check=False)
    print("\n=== Deploy done ===")
    print(f"App dir: {REMOTE_DIR}")
    ssh.close()


if __name__ == "__main__":
    main()
