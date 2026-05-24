#!/usr/bin/env python3
"""Allow medtracker user from Next server (192.168.1.32) on DB server (192.168.1.14)."""
import paramiko

DB_HOST = "192.168.1.14"
NEXT_HOST = "192.168.1.32"
PW = "kerkpoort"

SQL = f"""
CREATE USER IF NOT EXISTS 'medtracker'@'{NEXT_HOST}' IDENTIFIED BY '{PW}';
GRANT SELECT, INSERT, UPDATE, DELETE ON medtracker.* TO 'medtracker'@'{NEXT_HOST}';
FLUSH PRIVILEGES;
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(DB_HOST, username="root", password=PW, timeout=15)
sftp = ssh.open_sftp()
with sftp.file("/tmp/grant.sql", "w") as f:
    f.write(SQL)
sftp.close()
run_cmd = "mysql -uroot -pkerkpoort < /tmp/grant.sql && rm /tmp/grant.sql"
_, o, e = ssh.exec_command(run_cmd)
print(o.read().decode())
err = e.read().decode()
if err:
    print(err)
ssh.close()
print("Grants applied on", DB_HOST)
