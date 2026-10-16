#!/usr/bin/env python3
"""Allow medtracker user from Next server (192.168.1.32) on DB server (192.168.1.14)."""
from homelab import mysql_root, secret, ssh_connect

DB_HOST = "192.168.1.14"
NEXT_HOST = "192.168.1.32"
PW = secret("MEDTRACKER_DB_PASS")

SQL = f"""
CREATE USER IF NOT EXISTS 'medtracker'@'{NEXT_HOST}' IDENTIFIED BY '{PW}';
GRANT SELECT, INSERT, UPDATE, DELETE ON medtracker.* TO 'medtracker'@'{NEXT_HOST}';
FLUSH PRIVILEGES;
"""

ssh = ssh_connect(DB_HOST, timeout=15)
sftp = ssh.open_sftp()
with sftp.file("/tmp/grant.sql", "w") as f:
    f.write(SQL)
sftp.close()
run_cmd = f"{mysql_root()} < /tmp/grant.sql && rm /tmp/grant.sql"
_, o, e = ssh.exec_command(run_cmd)
print(o.read().decode())
err = e.read().decode()
if err:
    print(err)
ssh.close()
print("Grants applied on", DB_HOST)
