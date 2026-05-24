#!/usr/bin/env python3
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("192.168.1.32", username="root", password="kerkpoort", timeout=30)
_, o, _ = ssh.exec_command(
    "pm2 jlist 2>/dev/null | python3 -c \"import sys,json; "
    "d=json.load(sys.stdin); "
    "[print(x['name'], x.get('pm2_env',{}).get('env',{}).get('PORT','?')) for x in d]\" 2>/dev/null; "
    "ss -tlnp | grep -E ':30[0-9]{2}'"
)
print(o.read().decode())
ssh.close()
