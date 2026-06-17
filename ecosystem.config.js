/**
 * PM2 Ecosystem Configuration for Production
 *
 * Usage:
 *   Development:  pm2 start ecosystem.config.js --env development
 *   Production:   pm2 start ecosystem.config.js --env production
 *
 * Commands:
 *   pm2 status                          # List all apps
 *   pm2 logs backend                    # View logs
 *   pm2 restart backend                 # Restart app
 *   pm2 monit                           # Monitor resources
 *   pm2 save                            # Save state
 *   pm2 startup                         # Auto-start on system boot
 *   pm2 delete ecosystem.config.js      # Stop & remove
 */

module.exports = {
  apps: [
    {
      // ════════════════════════════════════════════════════════════════════
      // Backend API Server
      // ════════════════════════════════════════════════════════════════════
      name: "backend",
      script: "./backend/src/server.js",
      cwd: __dirname,

      // ── Environment ──────────────────────────────────────────────────
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },

      // ── Clustering & Instances ──────────────────────────────────────
      instances: 1,                    // 1 instance for single-core VPS
      exec_mode: "cluster",            // Use cluster mode
      max_memory_restart: "500M",       // Restart if memory > 500MB

      // ── Watch & Ignore ──────────────────────────────────────────────
      watch: ["backend/src"],           // Watch source files in development
      watch_delay: 1000,
      ignore_watch: [
        "node_modules",
        "dist",
        ".git",
        ".env",
      ],
      env_production: {
        watch: false,                   // Disable watch in production
      },

      // ── Logs ──────────────────────────────────────────────────────
      error_file: "/var/log/pm2/backend-error.log",
      out_file: "/var/log/pm2/backend-out.log",
      log_file: "/var/log/pm2/backend-combined.log",
      time: true,                       // Prefix logs with timestamps

      // ── Restart Policy ──────────────────────────────────────────────
      max_restarts: 10,                 // Max restarts in 1 minute
      min_uptime: "10s",                // Min uptime before restart counts
      autorestart: true,                // Auto-restart on crash

      // ── Graceful Shutdown ──────────────────────────────────────────
      kill_timeout: 5000,               // Wait 5s before kill -9
      listen_timeout: 3000,             // Startup timeout
      shutdown_with_message: true,

      // ── Advanced ──────────────────────────────────────────────────
      merge_logs: true,                 // Merge stdout/stderr
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      // ── Performance ──────────────────────────────────────────────
      // CPU affinity for cluster mode (optional)
      // exec_mode: "cluster_mode",
      // instances: "max",  // Use all available CPU cores
    },
  ],

  // ════════════════════════════════════════════════════════════════════
  // Deploy Configuration (optional, for CI/CD)
  // ════════════════════════════════════════════════════════════════════
  deploy: {
    production: {
      user: "deploy",
      host: "vps.example.com",
      ref: "origin/main",
      repo: "git@github.com:your-org/bitlogic-client-hub.git",
      path: "/var/www/bitlogic-client-hub",
      "post-deploy":
        "npm install && npm run build && pm2 restart backend --env production",
    },
  },
};
