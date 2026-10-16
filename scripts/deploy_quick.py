#!/usr/bin/env python3
"""Upload + build + PM2 restart (does not touch .env or MySQL)."""
import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko
from homelab import ssh_connect

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import HOST, PROJECT_ROOT, REMOTE_DIR, SKIP_DIRS, SKIP_FILES, USER, run


def upload(ssh: paramiko.SSHClient) -> None:
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
        sftp.put(tar_path, "/tmp/med-track-deploy.tar.gz")
        sftp.close()
        run(ssh, f"tar -xzf /tmp/med-track-deploy.tar.gz -C {REMOTE_DIR}")
        run(ssh, "rm -f /tmp/med-track-deploy.tar.gz")
    finally:
        if os.path.exists(tar_path):
            os.unlink(tar_path)


def main() -> None:
    ssh = ssh_connect(HOST, USER)
    upload(ssh)
    run(ssh, f"cd {REMOTE_DIR} && npm ci", timeout=600)
    run(ssh, f"cd {REMOTE_DIR} && npm run build", timeout=600)
    run(ssh, "pm2 restart med-next-pwa --update-env", check=False)
    run(ssh, "pm2 list | grep med-next", check=False)
    ssh.close()
    print("Quick deploy OK")


if __name__ == "__main__":
    main()
