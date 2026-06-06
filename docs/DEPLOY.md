# MedTracker deployen (zelfde server + Cloudflare Tunnel)

## Architectuur

- **Next.js** op server **NEXT** (`192.168.1.32`) → `/var/www/med-next-pwa` → poort **3007**
- **MySQL** op server **DB-server** (`192.168.1.14`) → database `medtracker`
- **Cloudflare Tunnel** op NEXT → `http://127.0.0.1:3007` (niet 3000; die poort is bezet)

```
Telefoon → HTTPS (subdomein) → Cloudflare Tunnel → Next.js :3007 → MySQL op 192.168.1.14
```

## 1. MySQL (phpMyAdmin als root)

1. Voer [`sql/schema.sql`](../sql/schema.sql) uit.
2. Maak app-user (niet root):

```sql
CREATE USER 'medtracker'@'localhost' IDENTIFIED BY 'sterk-wachtwoord';
GRANT SELECT, INSERT, UPDATE, DELETE ON medtracker.* TO 'medtracker'@'localhost';
FLUSH PRIVILEGES;
```

## 2. Omgevingsvariabelen

Op de server staat het sjabloon:

- `/var/www/med-next-pwa/.env.example` — standaard (verborgen in sommige bestandsbeheerders)

In SSH: `ls -la /var/www/med-next-pwa/.env*`

Kopieer naar `.env.local` en vul wachtwoorden in:

```bash
cp /var/www/med-next-pwa/.env.example /var/www/med-next-pwa/.env.local
nano /var/www/med-next-pwa/.env.local
```

Of lokaal: kopieer [`.env.example`](../.env.example) naar `/var/www/med-next-pwa/.env.local`:

```env
DATABASE_URL=mysql://medtracker:sterk-wachtwoord@127.0.0.1:3306/medtracker
SESSION_SECRET=<openssl rand -base64 32>
NODE_ENV=production
```

## 3. Build en start

```bash
cd /var/www/med-next-pwa
npm ci
npm run build
npm run start
```

Productie: gebruik **systemd** of **pm2** zodat Next.js blijft draaien.

Voorbeeld systemd unit `/etc/systemd/system/medtracker.service`:

```ini
[Unit]
Description=MedTracker Next.js
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/var/www/med-next-pwa
EnvironmentFile=/var/www/med-next-pwa/.env.local
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 4. Code bijwerken op de server

De app staat in een **git-repo** op de server (`/var/www/med-next-pwa`, remote `git@github.com:boerdb/med-next-pwa.git`). Er zijn twee manieren om nieuwe code te deployen. **Kies één methode en wissel niet af** — anders raakt git out of sync met de draaiende code.

### Methode A — `git pull` op de server (aanbevolen)

Gebruik dit als je op de server via SSH werkt en wijzigingen via GitHub pusht.

```bash
cd /var/www/med-next-pwa
git pull
npm ci
npm run build
pm2 restart med-next-pwa --update-env
```

Controle:

```bash
git status          # moet "working tree clean" tonen
git log -1 --oneline
pm2 list | grep med-next
```

### Methode B — deploy-script vanaf je PC

Uploadt een tarball naar de server **zonder** git bij te werken. Handig voor eerste installatie of als je geen git op de server wilt gebruiken.

```bash
# Volledige upload + build + PM2
python scripts/deploy_remote.py

# Alleen code uploaden + build + herstart (sneller)
python scripts/deploy_quick.py

# Alleen build/herstart (bestanden staan al op server)
python scripts/deploy_finish.py
```

**Let op:** deploy-scripts slaan `.git` over en overschrijven bestanden direct. Daardoor ziet git op de server lokale wijzigingen en untracked bestanden, terwijl de draaiende app wél up-to-date kan zijn. `git pull` faalt dan met fouten als:

```
error: Your local changes to the following files would be overwritten by merge
error: The following untracked working tree files would be overwritten by merge
```

### Git pull herstellen na gemengd deployen

Als je per ongeluk deploy-scripts én `git pull` door elkaar hebt gebruikt:

```bash
cd /var/www/med-next-pwa
git fetch origin
git reset --hard origin/main   # zet tracked bestanden gelijk met GitHub
git clean -fd                  # verwijdert untracked resten (niet .env.local)
git status                     # moet clean zijn
npm ci && npm run build
pm2 restart med-next-pwa --update-env
```

`.env.local` blijft behouden (staat in `.gitignore`). Gebruik **nooit** `git clean -fdx` — dat verwijdert ook ignored bestanden inclusief `.env.local`.

### Samenvatting

| | `git pull` (A) | deploy-script (B) |
|---|---|---|
| Waar | op server via SSH | vanaf je PC |
| Git op server | blijft synchroon | raakt out of sync |
| `.env.local` | blijft staan | blijft staan (niet in tarball) |
| Wanneer | normale updates | eerste installatie / no-git |

## 5. Cloudflare Tunnel

De app luistert op **poort 3007** (`pm2`, proces `med-next-pwa` — zelfde naam als de map).

In `config.yml` (pad kan verschillen):

```yaml
ingress:
  - hostname: medtracker.jouwdomein.nl
    service: http://127.0.0.1:3007
  - service: http_status:404
```

Deploy vanaf je PC (alleen als je **methode B** gebruikt — zie §4):

```bash
python scripts/deploy_remote.py
# of alleen build/herstart:
python scripts/deploy_finish.py
python scripts/deploy_pm2.py
python scripts/deploy_quick.py
```

Zorg dat in Cloudflare **SSL/TLS** op *Full* staat als je lokaal geen TLS hebt; de tunnel regelt HTTPS naar de gebruiker.

## 6. Push-meldingen (ook als de app dicht is)

1. Voer op MySQL [`sql/push-tables.sql`](../sql/push-tables.sql) uit (of opnieuw `schema.sql` op een lege DB).
2. Genereer VAPID-sleutels op de server:

```bash
npx web-push generate-vapid-keys
```

3. Zet in `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:med@clvs.nl
CRON_SECRET=<openssl rand -hex 32>
```

4. Zet ook `APP_TIMEZONE=Europe/Amsterdam` (medicatietijden zijn NL-lokale tijd; server draait vaak op UTC).
5. Herbouw en herstart PM2 (`npm run build`, `pm2 restart med-next-pwa --update-env`).
6. Cron op **NEXT** (elke minuut):

```bash
crontab -e
```

```cron
* * * * * curl -fsS -H "Authorization: Bearer JOUW_CRON_SECRET" "http://127.0.0.1:3007/api/cron/check-reminders" >/dev/null
```

7. In de app: **Vandaag** → bel-icoon → meldingen toestaan. Op iPhone: app eerst **toevoegen aan beginscherm**.

## 7. Eerste account

1. Open de app via je subdomein.
2. Klik **Aanmelden** → **Registreren** (geen gastmodus).
3. E-mail + wachtwoord (min. 8 tekens).

## Beveiliging

- Gebruik **nooit** `root` in `DATABASE_URL`.
- Houd `.env.local` buiten git.
- Wijzig standaardwachtwoorden na installatie.
