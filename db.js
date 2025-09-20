const { Pool } = require('pg');

const pool = new Pool({
      user: 'postgres',       // اسم المستخدم بتاع PostgreSQL
      host: 'localhost',      // شغال محلي
      database: 'Shafi',      // اسم الداتابيس
      password: 'K1252002k@', // الباسورد بتاعك
      port: 5432,
});

module.exports = pool;
