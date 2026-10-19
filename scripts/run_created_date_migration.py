#!/usr/bin/env python3
"""Apply sql/migration-created-date.sql on the DB server (idempotent)."""
import os
import sys
from pathlib import Path

from homelab import mysql_root, ssh_connect

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import PROJECT_ROOT, USER, run

DB_SSH_HOST = os.environ.get("DB_SSH_HOST", "192.168.1.14")


def main() -> None:
    sql = (PROJECT_ROOT / "sql" / "migration-created-date.sql").read_text(encoding="utf-8")
    print(f"Connecting DB server {USER}@{DB_SSH_HOST}...")
    ssh = ssh_connect(DB_SSH_HOST, USER)

    _, out, _ = run(
        ssh,
        f"{mysql_root()} medtracker -e \"SHOW COLUMNS FROM medications LIKE 'created_date';\"",
        check=False,
    )
    if "created_date" in out:
        print("Migration already applied (created_date exists).")
    else:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/migration-created-date.sql", "w") as f:
            f.write(sql)
        sftp.close()
        run(ssh, f"{mysql_root()} < /tmp/migration-created-date.sql")
        run(
            ssh,
            f"{mysql_root()} medtracker -e \"SELECT name, created_date FROM medications;\"",
            check=False,
        )
        print("Migration applied.")

    ssh.close()


if __name__ == "__main__":
    main()
