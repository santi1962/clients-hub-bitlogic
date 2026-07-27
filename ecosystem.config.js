/**
 * PM2 Ecosystem Configuration for Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *
 * Commands:
 *   pm2 status                          # List all apps
 *   pm2 logs bitlogic-backend           # View logs
 *   pm2 restart bitlogic-backend        # Restart app
 *   pm2 monit                           # Monitor resources
 *   pm2 save                            # Save state
 *   pm2 startup                         # Auto-start on system boot
 *
 * NOTE: backend runs with instances: 1 (not cluster/max) on purpose — the
 * support ticket chat uses Socket.IO in-memory rooms. Running multiple
 * cluster workers without a shared adapter (Redis) or nginx sticky sessions
 * would randomly drop real-time messages between workers.
 */

module.exports = {
  apps: [
    {
      name: "bitlogic-backend",
      script: "./backend/src/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      watch: false,
      ignore_watch: ["node_modules", "dist", ".git", ".env", "whatsapp-session"],
      error_file: "./logs/backend-error.log",
      out_file: "./logs/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "500M",
      kill_timeout: 5000,
      listen_timeout: 3000,
    },
    {
      // Server SSR de TanStack Start — generado por `npm run build` en dist/server/
      name: "bitlogic-frontend",
      script: "./dist/server/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      watch: false,
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "300M",
    },
  ],
};
