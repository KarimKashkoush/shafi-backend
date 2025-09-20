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
      user: process.env.DB_USER,       // من المتغيرات البيئية على Render
      host: process.env.DB_HOST,       // من المتغيرات البيئية على Render
      database: process.env.DB_NAME,   // من المتغيرات البيئية على Render
      password: process.env.DB_PASS,   // من المتغيرات البيئية على Render
      port: process.env.DB_PORT,       // عادة 5432
});

module.exports = pool;
