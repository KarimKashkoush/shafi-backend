const { Pool } = require('pg');

const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASS,
      port: process.env.DB_PORT,

      ssl: {
            require: true,
            rejectUnauthorized: false,
      },
});

pool.on('connect', (client) => {
      client.query(`SET TIME ZONE 'UTC';`).catch((error) => {
            console.error('Failed to enforce UTC timezone', error);
      });
});

module.exports = pool;
