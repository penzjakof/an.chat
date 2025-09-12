/*
 * PM2 ecosystem configuration
 * Secrets are NOT stored here. Server loads env from apps/server/.env via dotenv.
 */

module.exports = {
  apps: [
    {
      name: 'anchat-api',
      cwd: './apps/server',
      script: 'node',
      args: 'dist/main.js',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 5
    },
    {
      name: 'anchat-web',
      cwd: './apps/web',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 5
    }
  ]
};


