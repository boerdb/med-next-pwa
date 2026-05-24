#!/usr/bin/env python3
"""Upload .env.example and ensure .env.local exists on server."""
import secrets
from pathlib import Path

import paramiko

from deploy_remote import HOST, PASSWORD, REMOTE_DIR, USER

PROJECT = Path(__file__).resolve().parent.parent


def main() -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = ssh.open_sftp()

    example = PROJECT / ".env.example"
    sftp.put(str(example), f"{REMOTE_DIR}/.env.example")
    print(f"Uploaded {example.name} -> {REMOTE_DIR}/.env.example")

    # Create .env.local only if missing (do not overwrite existing secrets)
    _, stdout, _ = ssh.exec_command(f"test -f {REMOTE_DIR}/.env.local && echo exists")
    exists = "exists" in stdout.read().decode()
    if not exists:
        secret = secrets.token_urlsafe(32)
        local = f"""DATABASE_URL=mysql://medtracker:kerkpoort@127.0.0.1:3306/medtracker
SESSION_SECRET={secret}
NODE_ENV=production
"""
        with sftp.file(f"{REMOTE_DIR}/.env.local", "w") as f:
            f.write(local)
        print(f"Created {REMOTE_DIR}/.env.local")
    else:
        print(f"{REMOTE_DIR}/.env.local already exists (left unchanged)")

    sftp.close()
    ssh.close()
    print("Done.")


if __name__ == "__main__":
    main()
