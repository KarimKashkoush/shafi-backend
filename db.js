// const { Pool } = require('pg');

// const pool = new Pool({
//       user: 'postgres',       // اسم المستخدم بتاع PostgreSQL
//       host: 'localhost',      // شغال محلي
//       database: 'Shafi',      // اسم الداتابيس
//       password: 'K1252002k@', // الباسورد بتاعك
//       port: 5432,
// });

// module.exports = pool;



const { Pool } = require('pg');

const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASS,
      port: process.env.DB_PORT,
});

module.exports = pool;
