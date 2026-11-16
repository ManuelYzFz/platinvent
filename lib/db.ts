import mysql from 'mysql2/promise';


const globalForDb = global as unknown as { dbPool: mysql.Pool };

export const pool =
  globalForDb.dbPool ||
  mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, 
    queueLimit: 0,
    // Devolver DATE como 'YYYY-MM-DD' en lugar de objetos Date
    dateStrings: true,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.dbPool = pool;

export default pool;