# MedTracker deployen (zelfde server + Cloudflare Tunnel)

## Architectuur

- **Next.js** en **MySQL** op dezelfde machine (`/var/www/med-track-pwa`)
- MySQL alleen via `127.0.0.1` (niet open op internet)
- **Cloudflare Tunnel** exposeert het subdomein met HTTPS naar `localhost:3000` (of je reverse proxy)

```
Telefoon → HTTPS (subdomein) → Cloudflare Tunnel → Next.js :3000 → MySQL :3306 (localhost)
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

Op de server staan twee sjablonen (zelfde inhoud):

- `/var/www/med-track-pwa/.env.example` — standaard (verborgen in sommige bestandsbeheerders)
- `/var/www/med-track-pwa/env.example` — zichtbare kopie zonder leading dot

In SSH: `ls -la /var/www/med-track-pwa/.env*`

Kopieer naar `.env.local` en vul wachtwoorden in:

```bash
cp /var/www/med-track-pwa/.env.example /var/www/med-track-pwa/.env.local
nano /var/www/med-track-pwa/.env.local
```

Of lokaal: kopieer [`.env.example`](../.env.example) naar `/var/www/med-track-pwa/.env.local`:

```env
DATABASE_URL=mysql://medtracker:sterk-wachtwoord@127.0.0.1:3306/medtracker
SESSION_SECRET=<openssl rand -base64 32>
NODE_ENV=production
```

## 3. Build en start

```bash
cd /var/www/med-track-pwa
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
WorkingDirectory=/var/www/med-track-pwa
EnvironmentFile=/var/www/med-track-pwa/.env.local
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 4. Cloudflare Tunnel

De app luistert op **poort 3000** (`pm2`, proces `med-track-pwa`).

In `config.yml` (pad kan verschillen):

```yaml
ingress:
  - hostname: medtracker.jouwdomein.nl
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Deploy vanaf je PC (SSH root):

```bash
python scripts/deploy_remote.py
# of alleen build/herstart:
python scripts/deploy_finish.py
python scripts/deploy_pm2.py
```

Zorg dat in Cloudflare **SSL/TLS** op *Full* staat als je lokaal geen TLS hebt; de tunnel regelt HTTPS naar de gebruiker.

## 5. Eerste account

1. Open de app via je subdomein.
2. Klik **Aanmelden** → **Registreren** (geen gastmodus).
3. E-mail + wachtwoord (min. 8 tekens).

## 6. Data uit InstantDB

Zie [`scripts/migrate-instant-to-mysql.mjs`](../scripts/migrate-instant-to-mysql.mjs) en een handmatige JSON-export uit het Instant-dashboard.

## Beveiliging

- Gebruik **nooit** `root` in `DATABASE_URL`.
- Houd `.env.local` buiten git.
- Wijzig standaardwachtwoorden na import.
