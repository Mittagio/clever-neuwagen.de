/** PM2 – Clever-Neuwagen auf IONOS VPS */
module.exports = {
  apps: [
    {
      name: 'clever-neuwagen',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '127.0.0.1',
        PUBLIC_URL: 'https://www.clever-neuwagen.de',
        // Berater-Persistenz außerhalb von dist/ (deploy/update-app.sh legt Verzeichnis an)
        PILOT_DATA_DIR: '/var/lib/clever-neuwagen/data',
      },
    },
  ],
};
