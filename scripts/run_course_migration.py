#!/usr/bin/env python3
"""Apply sql/migration-course.sql on the DB server (idempotent)."""
import os
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import PASSWORD, PROJECT_ROOT, USER, run

DB_SSH_HOST = os.environ.get("DB_SSH_HOST", "192.168.1.14")


def main() -> None:
    sql = (PROJECT_ROOT / "sql" / "migration-course.sql").read_text(encoding="utf-8")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting DB server {USER}@{DB_SSH_HOST}...")
    ssh.connect(DB_SSH_HOST, username=USER, password=PASSWORD, timeout=30)

    _, out, _ = run(
        ssh,
        "mysql -uroot -pkerkpoort medtracker -e \"SHOW COLUMNS FROM medications LIKE 'course_start_date';\"",
        check=False,
    )
    if "course_start_date" in out:
        print("Migration already applied (course_start_date exists).")
    else:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/migration-course.sql", "w") as f:
            f.write(sql)
        sftp.close()
        run(ssh, "mysql -uroot -pkerkpoort < /tmp/migration-course.sql")
        run(
            ssh,
            "mysql -uroot -pkerkpoort medtracker -e \"SHOW COLUMNS FROM medications LIKE 'course_%';\"",
            check=False,
        )
        print("Migration applied.")

    ssh.close()


if __name__ == "__main__":
    main()
