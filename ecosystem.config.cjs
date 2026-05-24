/** PM2 config — MedTracker op poort 3010 (3000 is vaak al bezet op deze server). */
module.exports = {
  apps: [
    {
      name: 'med-next-pwa',
      cwd: '/var/www/med-next-pwa',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
        TZ: 'Europe/Amsterdam',
        APP_TIMEZONE: 'Europe/Amsterdam',
      },
    },
  ],
};
