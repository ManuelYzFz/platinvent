import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // 1. Probar un ping básico al servidor MySQL
    const [pingResult] = await pool.query('SELECT 1 + 1 AS test, NOW() AS serverTime');

    // 2. Probar consultar la tabla companies
    let companiesCount = 0;
    let sampleCompanies: unknown[] = [];
    try {
      const [rows] = await pool.query('SELECT * FROM companies LIMIT 5');
      sampleCompanies = Array.isArray(rows) ? rows : [];
      companiesCount = sampleCompanies.length;
    } catch (tableErr: unknown) {
      console.warn('Advertencia al consultar tabla companies:', tableErr);
    }

    return NextResponse.json({
      status: 'success',
      connected: true,
      message: '¡Conexión exitosa a la base de datos de cPanel!',
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      serverInfo: pingResult,
      companiesCount,
      sampleCompanies,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; errno?: number };
    console.error('Error de conexión a la BD:', error);

    return NextResponse.json(
      {
        status: 'error',
        connected: false,
        message: 'No se pudo conectar a la base de datos.',
        errorCode: err.code || 'UNKNOWN',
        errorDetails: err.message || String(error),
        hint:
          err.code === 'ETIMEDOUT'
            ? 'Timeout: Muy probable que tu IP no esté autorizada en Remote MySQL de cPanel o el puerto 3306 esté bloqueado.'
            : err.code === 'ER_ACCESS_DENIED_ERROR'
            ? 'Acceso denegado: Revisa que el usuario y contraseña en .env coincidan exactamente y que el usuario tenga privilegios en la base de datos.'
            : 'Revisa las variables en tu archivo .env',
      },
      { status: 500 }
    );
  }
}
