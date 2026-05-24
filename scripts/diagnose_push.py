#!/usr/bin/env python3
import sys
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_remote import DB_HOST, HOST, PASSWORD, REMOTE_DIR, USER, run

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "date",
    "timedatectl 2>/dev/null | head -5 || true",
    f"grep -E '^(TZ|NEXT_PUBLIC_VAPID|CRON_SECRET)=' {REMOTE_DIR}/.env.local | sed 's/CRON_SECRET=.*/CRON_SECRET=***/' | sed 's/VAPID_PRIVATE.*/VAPID_PRIVATE=***/'",
    f"node -e \"const d=new Date(); console.log('server local:', d.toString()); console.log('ISO:', d.toISOString()); console.log('dateKey:', d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')); console.log('hour:', d.getHours());\"",
    f"bash -lc 'set -a && . {REMOTE_DIR}/.env.local && set +a && curl -fsS -H \"Authorization: Bearer $CRON_SECRET\" http://127.0.0.1:3007/api/cron/check-reminders'",
    "crontab -l 2>/dev/null | grep check-reminders || echo NO_CRON",
    f"mysql -h {DB_HOST} -umedtracker -pkerkpoort medtracker -e \"SELECT COUNT(*) AS subs FROM push_subscriptions; SELECT user_id, LEFT(endpoint_hash,12) h FROM push_subscriptions LIMIT 5;\"",
    f"mysql -h {DB_HOST} -umedtracker -pkerkpoort medtracker -e \"SELECT name, times FROM medications LIMIT 10;\"",
    f"mysql -h {DB_HOST} -umedtracker -pkerkpoort medtracker -e \"SELECT slot_key, first_sent, second_sent FROM push_reminder_flags ORDER BY slot_key DESC LIMIT 10;\"",
    "pm2 env 26 2>/dev/null | grep -E 'TZ|PORT' || pm2 describe med-next-pwa | grep -E 'status|PORT'",
]
for c in cmds:
    print("\n===", c[:80], "===")
    run(ssh, c, check=False)
ssh.close()
