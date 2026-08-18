#!/usr/bin/env python3
"""Apply sql/migration-as-needed.sql on the DB server (idempotent)."""
import os
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import PASSWORD, PROJECT_ROOT, USER, run

DB_SSH_HOST = os.environ.get("DB_SSH_HOST", "192.168.1.14")


def main() -> None:
    sql = (PROJECT_ROOT / "sql" / "migration-as-needed.sql").read_text(encoding="utf-8")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting DB server {USER}@{DB_SSH_HOST}...")
    ssh.connect(DB_SSH_HOST, username=USER, password=PASSWORD, timeout=30)

    _, out, _ = run(
        ssh,
        "mysql -uroot -pkerkpoort medtracker -e \"SHOW COLUMNS FROM medications LIKE 'as_needed';\"",
        check=False,
    )
    if "as_needed" in out:
        print("Migration already applied (as_needed exists).")
    else:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/migration-as-needed.sql", "w") as f:
            f.write(sql)
        sftp.close()
        run(ssh, "mysql -uroot -pkerkpoort < /tmp/migration-as-needed.sql")
        run(
            ssh,
            "mysql -uroot -pkerkpoort medtracker -e \"SHOW COLUMNS FROM medications LIKE 'as_needed';\"",
            check=False,
        )
        print("Migration applied.")

    ssh.close()


if __name__ == "__main__":
    main()
