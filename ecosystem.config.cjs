module.exports = {
  apps: [
    {
      name: "nuannuan-emotional-h5",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 4173,
      },
    },
  ],
};
