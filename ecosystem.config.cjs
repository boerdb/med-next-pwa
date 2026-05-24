/** PM2 config — MedTracker op poort 3010 (3000 is vaak al bezet op deze server). */
module.exports = {
  apps: [
    {
      name: 'med-track-pwa',
      cwd: '/var/www/med-next-pwa',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
      },
    },
  ],
};
