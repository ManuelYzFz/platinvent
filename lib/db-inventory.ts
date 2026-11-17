import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { DEVICE_TYPES, FieldValidator } from '@/lib/validation/inventory';

/**
 * Acceso a MySQL para empresas, vehículos, SIMs y dispositivos.
 * Devuelve los registros con la misma forma que usaban los JSON de datoslocales/
 * para que el frontend no necesite cambios.
 */

type Conn = PoolConnection | typeof pool;
type Body = Record<string, unknown>;

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim());
const today = () => new Date().toISOString().slice(0, 10);

const dateToMs = (v: unknown): number | null => {
  if (!v) return null;
  const t = Date.parse(String(v));
  return isNaN(t) ? null : t;
};

async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// Resolución de relaciones
// ---------------------------------------------------------------------------

/** Busca la empresa por id o nombre; si sólo hay nombre y no existe, la crea. (Datos ya validados) */
async function resolveCompanyId(conn: Conn, id: number | null, nameRaw: string | null): Promise<number | null> {
  const name = nameRaw ?? '';

  if (name) {
    const [byName] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );
    if (byName.length) return byName[0].id;
  }
  if (id && id > 0) {
    const [byId] = await conn.query<RowDataPacket[]>('SELECT id FROM companies WHERE id = ?', [id]);
    if (byId.length) return byId[0].id;
  }
  if (name) {
    const [res] = await conn.query<ResultSetHeader>('INSERT INTO companies (name) VALUES (?)', [name]);
    return res.insertId;
  }
  return null;
}

/** Busca el vehículo por patente o id; si no existe y hay patente, lo crea. (Datos ya validados) */
async function resolveVehicleId(conn: Conn, refRaw: string | null, companyId: number | null): Promise<number | null> {
  const ref = (refRaw ?? '').toUpperCase();
  if (!ref) return null;

  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id FROM vehicles WHERE UPPER(plate_number) = ? OR id = ? LIMIT 1',
    [ref, /^\d+$/.test(ref) ? Number(ref) : -1]
  );
  if (rows.length) return rows[0].id;

  const [res] = await conn.query<ResultSetHeader>(
    'INSERT INTO vehicles (plate_number, company_id) VALUES (?, ?)',
    [ref, companyId]
  );
  return res.insertId;
}

/** Busca una SIM por ICCID o número de tarjeta. */
async function findSimId(conn: Conn, ...refs: unknown[]): Promise<number | null> {
  for (const r of refs) {
    const ref = str(r).replace(/\+/g, '');
    if (!ref) continue;
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM simcards WHERE simcard = ? OR card_number = ? LIMIT 1',
      [ref, ref]
    );
    if (rows.length) return rows[0].id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

export async function listCompanies() {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name FROM companies ORDER BY id');
  return { result: 0, companys: rows.map((r) => ({ id: r.id, name: r.name, pId: 1 })) };
}

export async function saveCompany(nameRaw: unknown) {
  const v = new FieldValidator();
  const name = v.field('companyName', nameRaw, { required: true });
  v.assert();
  const id = await resolveCompanyId(pool, null, name);
  return { id, name, pId: 1 };
}

// ---------------------------------------------------------------------------
// Vehículos
// ---------------------------------------------------------------------------

export async function listVehicles() {
  const [vehicles] = await pool.query<RowDataPacket[]>(
    `SELECT v.*, c.name AS company_name
       FROM vehicles v LEFT JOIN companies c ON c.id = v.company_id
      ORDER BY v.id DESC`
  );
  const [devs] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, d.devidno, d.vehicle_id, s.simcard
       FROM devices d LEFT JOIN simcards s ON s.id = d.simcard_id
      WHERE d.vehicle_id IS NOT NULL`
  );

  const infos = vehicles.map((v) => {
    const companyName = v.company_name ?? null;
    return {
      id: v.id,
      vid: v.plate_number,
      lp: v.plate_number,
      vehiIdno: v.plate_number,
      com: v.company_id
        ? { id: String(v.company_id), name: companyName, companyId: v.company_id, companyName }
        : null,
      companyId: v.company_id,
      companyName,
      brand: v.brand,
      model: v.model,
      vehicleType: v.vehicle_type,
      itm: v.registration_date,
      itmDate: dateToMs(v.registration_date),
      stm: 'Sin servicio',
      devList: devs
        .filter((d) => d.vehicle_id === v.id)
        .map((d) => ({ id: String(d.id), name: d.devidno, simInfo: d.simcard ?? null, serialID: d.devidno })),
    };
  });

  return { result: 0, infos };
}

export async function saveVehicle(body: Body) {
  const vehicle = (body.vehicle ?? {}) as Body;
  const v = new FieldValidator();
  const plate = v.field('plate', body.vid || body.lp || body.vehiIdno || vehicle.vid || vehicle.lp, { required: true });
  const companyIdIn = v.int('El ID de empresa', body.companyId ?? vehicle.companyId, { min: 1 });
  const companyName = v.field('companyName', body.companyName ?? vehicle.companyName);
  v.assert();

  const companyId = await resolveCompanyId(pool, companyIdIn, companyName);
  const id = await resolveVehicleId(pool, plate, companyId);
  const { infos } = await listVehicles();
  return infos.find((v) => v.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// SIM Cards
// ---------------------------------------------------------------------------

const SIM_SELECT = `
  SELECT s.*, c.name AS company_name, d.devidno, v.plate_number
    FROM simcards s
    LEFT JOIN companies c ON c.id = s.company_id
    LEFT JOIN devices d ON d.simcard_id = s.id
    LEFT JOIN vehicles v ON v.id = d.vehicle_id`;

function mapSim(s: RowDataPacket) {
  return {
    id: s.id,
    simCard: s.simcard,
    cardNum: s.card_number,
    // Columna booleana; la UI usa 1 = Habilitado, 2 = No habilitado.
    // Filas antiguas pueden tener un 2 guardado directamente: sólo 1 cuenta como habilitado.
    status: s.status === null || s.status === undefined ? null : Number(s.status) === 1 ? 1 : 2,
    install: s.install ?? 0,
    planName: s.plan_name,
    city: s.city,
    cardMerchant: s.card_merchant,
    msisdn: s.msisdn,
    serviceProvider: s.service_provider,
    endTime: s.expiration_date,
    registrationTime: dateToMs(s.registration_date),
    updateTime: null,
    remark: null,
    operator: null,
    companyID: s.company_id,
    companyName: s.company_name ?? null,
    devIDNO: s.devidno ?? null,
    vehiIDNO: s.plate_number ?? null,
  };
}

export async function listSims() {
  const [rows] = await pool.query<RowDataPacket[]>(`${SIM_SELECT} ORDER BY s.id DESC`);
  return { result: 0, infos: rows.map(mapSim) };
}

export async function countSims(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM simcards');
  return rows[0].n;
}

export async function saveSim(sim: Body) {
  const v = new FieldValidator();
  const devIdno = v.field('devidno', sim.devIDNO);
  const companyIdIn = v.int('El ID de empresa', sim.companyID ?? sim.companyId, { min: 1 });
  const companyName = v.field('companyName', sim.companyName);
  const values = {
    simcard: v.field('iccid', sim.simCard),
    card_number: v.field('phone', sim.cardNum),
    status: v.bool('El estado', sim.status, { aliases: { '2': 0 } }) ?? 1,
    install: v.bool('El estado de instalación', sim.install) ?? (devIdno ? 1 : 0),
    plan_name: v.field('planName', sim.planName),
    city: v.field('city', sim.city),
    card_merchant: v.field('cardMerchant', sim.cardMerchant),
    msisdn: v.field('msisdn', sim.msisdn),
    service_provider: v.field('serviceProvider', sim.serviceProvider),
    expiration_date: v.date('La fecha de expiración', sim.endTime),
  };
  const registrationDate = v.date('La fecha de registro', sim.registrationTime);
  if (!str(sim.simCard) && !str(sim.cardNum)) {
    v.errors.push('Se requiere el código simCard o el número de tarjeta.');
  }
  v.assert();

  return withTransaction(async (conn) => {
    const companyId = await resolveCompanyId(conn, companyIdIn, companyName);

    let simId: number | null = null;
    if (sim.id !== undefined && sim.id !== null && /^\d+$/.test(str(sim.id))) {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT id FROM simcards WHERE id = ?', [Number(sim.id)]);
      if (rows.length) simId = rows[0].id;
    }

    if (simId) {
      await conn.query('UPDATE simcards SET ? WHERE id = ?', [{ ...values, company_id: companyId }, simId]);
    } else {
      const [res] = await conn.query<ResultSetHeader>('INSERT INTO simcards SET ?', [
        { ...values, company_id: companyId, registration_date: registrationDate ?? today() },
      ]);
      simId = res.insertId;
    }

    // La relación SIM ↔ dispositivo vive en devices.simcard_id
    await conn.query('UPDATE devices SET simcard_id = NULL WHERE simcard_id = ?', [simId]);
    if (devIdno) {
      await conn.query('UPDATE devices SET simcard_id = ? WHERE devidno = ?', [simId, devIdno]);
    }

    const [rows] = await conn.query<RowDataPacket[]>(`${SIM_SELECT} WHERE s.id = ?`, [simId]);
    return mapSim(rows[0]);
  });
}

// ---------------------------------------------------------------------------
// Dispositivos
// ---------------------------------------------------------------------------

const DEVICE_SELECT = `
  SELECT d.*, c.name AS company_name, v.plate_number, s.simcard, s.card_number
    FROM devices d
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN vehicles v ON v.id = d.vehicle_id
    LEFT JOIN simcards s ON s.id = d.simcard_id`;

function mapDevice(d: RowDataPacket) {
  const devType = d.dev_type ?? null;
  return {
    id: d.id,
    devIDNO: d.devidno,
    imei: d.imei,
    serialID: d.serial_id,
    brand: d.brand,
    model: d.model,
    devType,
    install: d.install ?? 0,
    serviceStatus: d.service_status ? 'active' : 'inactive',
    companyId: d.company_id,
    companyName: d.company_name ?? null,
    vehiIdno: d.plate_number ?? null,
    simInfo: d.simcard ?? null,
    actualCardNumber: d.card_number ?? null,
    registrationDate: d.registration_date,
    assignmentDate: d.assignment_date,
    qrCode: d.qr_code,
    chnName: devType === 7 ? 'CH1,CH2,CH3,CH4' : null,
    factoryDevType: devType === 7 && d.install ? 1 : 0,
    ifMainDefense: 0,
  };
}

export async function listDevices() {
  const [rows] = await pool.query<RowDataPacket[]>(`${DEVICE_SELECT} ORDER BY d.id DESC`);
  return { result: 0, infos: rows.map(mapDevice) };
}

export async function countDevices(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM devices');
  return rows[0].n;
}

/** Inserta o actualiza un dispositivo, validando cada campo contra el tipo de su columna. */
export async function saveDevice(dev: Body) {
  const v = new FieldValidator();
  const devIdno = v.field('devidno', dev.devIDNO || dev.devIdno, { required: true }) ?? '';
  const installed = v.bool('El estado de instalación', dev.install) ?? 0;
  const serviceStatus = v.bool('El estado de servicio', dev.serviceStatus, {
    aliases: { active: 1, inactive: 0 },
  });
  const fields = {
    imei: v.field('imei', dev.imei),
    serial_id: v.field('serialId', dev.serialID),
    brand: v.field('deviceBrand', dev.brand),
    model: v.field('deviceModel', dev.model),
    dev_type: v.int('El tipo de dispositivo', dev.devType, { required: true, allowed: Object.values(DEVICE_TYPES) }),
    qr_code: v.text('El código QR', dev.qrCode),
  };
  const companyIdIn = v.int('El ID de empresa', dev.companyId, { min: 1 });
  const companyName = v.field('companyName', dev.companyName);
  const plate = v.field('plate', dev.vehiIdno);
  const simRef = v.field('simRef', dev.simInfo);
  const cardRef = v.field('cardRef', dev.actualCardNumber);
  const assignmentDate = v.date('La fecha de asignación', dev.assignmentDate);
  const registrationDate = v.date('La fecha de registro', dev.registrationDate);
  v.assert();

  return withTransaction(async (conn) => {

    // Buscar existente: primero por id numérico (ediciones), luego por devIDNO
    let existing: RowDataPacket | null = null;
    if (/^\d+$/.test(str(dev.id))) {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM devices WHERE id = ?', [Number(dev.id)]);
      existing = rows[0] ?? null;
    }
    if (!existing) {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM devices WHERE devidno = ? LIMIT 1', [devIdno]);
      existing = rows[0] ?? null;
    }

    const companyId = installed === 1 ? await resolveCompanyId(conn, companyIdIn, companyName || 'Opentraxx') : null;
    const vehicleId = installed === 1 ? await resolveVehicleId(conn, plate, companyId) : null;
    const simId = (await findSimId(conn, simRef, cardRef)) ?? existing?.simcard_id ?? null;

    const values = {
      ...fields,
      devidno: devIdno,
      install: installed,
      service_status: serviceStatus ?? installed,
      company_id: companyId,
      vehicle_id: vehicleId,
      simcard_id: simId,
      assignment_date: vehicleId ? assignmentDate ?? today() : null,
    };

    let id: number;
    if (existing) {
      id = existing.id;
      await conn.query('UPDATE devices SET ? WHERE id = ?', [values, id]);
    } else {
      const [res] = await conn.query<ResultSetHeader>('INSERT INTO devices SET ?', [
        { ...values, registration_date: registrationDate ?? today() },
      ]);
      id = res.insertId;
    }

    // La SIM asociada hereda instalación y empresa del dispositivo
    if (simId) {
      await conn.query(
        'UPDATE simcards SET install = ?, company_id = COALESCE(?, company_id) WHERE id = ?',
        [installed, companyId, simId]
      );
    }

    const [rows] = await conn.query<RowDataPacket[]>(`${DEVICE_SELECT} WHERE d.id = ?`, [id]);
    return mapDevice(rows[0]);
  });
}

/** Elimina un dispositivo de la base de datos y libera la SIM asociada. */
export async function deleteDevice(id?: number | string, devIdno?: string) {
  return withTransaction(async (conn) => {
    let existing: RowDataPacket | null = null;
    if (id !== undefined && id !== null && /^\d+$/.test(String(id).trim())) {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM devices WHERE id = ? LIMIT 1', [Number(id)]);
      existing = rows[0] ?? null;
    }
    if (!existing && devIdno && String(devIdno).trim()) {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM devices WHERE devidno = ? LIMIT 1', [String(devIdno).trim()]);
      existing = rows[0] ?? null;
    }

    if (!existing) {
      throw new Error('Dispositivo no encontrado');
    }

    // Si tiene SIM asociada, desmarcarla como instalada
    if (existing.simcard_id) {
      await conn.query('UPDATE simcards SET install = 0 WHERE id = ?', [existing.simcard_id]);
    }

    await conn.query('DELETE FROM devices WHERE id = ?', [existing.id]);

    return { success: true, deletedId: existing.id, devidno: existing.devidno };
  });
}

// ---------------------------------------------------------------------------
// Opciones de marca / modelo (Catálogo y CRUD)
// ---------------------------------------------------------------------------

export async function listDeviceOptions() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT TRIM(brand) AS brand, TRIM(model) AS model
         FROM (
           SELECT brand, model FROM device_models
           UNION
           SELECT brand, model FROM devices WHERE brand IS NOT NULL AND TRIM(brand) <> ''
         ) AS combined
        WHERE brand IS NOT NULL AND TRIM(brand) <> ''
        ORDER BY brand, model`
    );

    const brands = new Map<string, string>();
    const models: { brand: string; model: string }[] = [];
    for (const r of rows) {
      const key = String(r.brand).toLowerCase();
      if (!brands.has(key)) brands.set(key, r.brand);
      if (r.model && String(r.model).trim()) {
        models.push({ brand: brands.get(key)!, model: String(r.model).trim() });
      }
    }

    return { brands: Array.from(brands.values()), models };
  } catch (error) {
    console.error('Error listDeviceOptions (fallback to devices):', error);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT TRIM(brand) AS brand, TRIM(model) AS model
         FROM devices
        WHERE brand IS NOT NULL AND TRIM(brand) <> ''
        ORDER BY brand, model`
    );
    const brands = new Map<string, string>();
    const models: { brand: string; model: string }[] = [];
    for (const r of rows) {
      const key = String(r.brand).toLowerCase();
      if (!brands.has(key)) brands.set(key, r.brand);
      if (r.model) models.push({ brand: brands.get(key)!, model: r.model });
    }
    return { brands: Array.from(brands.values()), models };
  }
}

export async function addBrandModel(brand: string, model = '') {
  const cleanBrand = brand.trim();
  const cleanModel = model.trim();
  if (!cleanBrand) throw new Error('El nombre de la marca es obligatorio');

  await pool.query(
    'INSERT IGNORE INTO device_models (brand, model) VALUES (?, ?)',
    [cleanBrand, cleanModel]
  );
  return listDeviceOptions();
}

export async function updateBrand(oldBrand: string, newBrand: string) {
  const cleanOld = oldBrand.trim();
  const cleanNew = newBrand.trim();
  if (!cleanOld || !cleanNew) throw new Error('Los nombres de marca son requeridos');

  await withTransaction(async (conn) => {
    await conn.query('UPDATE device_models SET brand = ? WHERE LOWER(brand) = LOWER(?)', [cleanNew, cleanOld]);
    await conn.query('UPDATE devices SET brand = ? WHERE LOWER(brand) = LOWER(?)', [cleanNew, cleanOld]);
  });

  return listDeviceOptions();
}

export async function updateModel(brand: string, oldModel: string, newModel: string) {
  const cleanBrand = brand.trim();
  const cleanOld = oldModel.trim();
  const cleanNew = newModel.trim();
  if (!cleanBrand || !cleanOld || !cleanNew) throw new Error('Marca y modelos son requeridos');

  await withTransaction(async (conn) => {
    await conn.query(
      'UPDATE device_models SET model = ? WHERE LOWER(brand) = LOWER(?) AND LOWER(model) = LOWER(?)',
      [cleanNew, cleanBrand, cleanOld]
    );
    await conn.query(
      'UPDATE devices SET model = ? WHERE LOWER(brand) = LOWER(?) AND LOWER(model) = LOWER(?)',
      [cleanNew, cleanBrand, cleanOld]
    );
  });

  return listDeviceOptions();
}

export async function deleteModel(brand: string, model: string) {
  const cleanBrand = brand.trim();
  const cleanModel = model.trim();
  if (!cleanBrand || !cleanModel) throw new Error('Marca y modelo son requeridos');

  await pool.query(
    'DELETE FROM device_models WHERE LOWER(brand) = LOWER(?) AND LOWER(model) = LOWER(?)',
    [cleanBrand, cleanModel]
  );
  return listDeviceOptions();
}

export async function deleteBrand(brand: string) {
  const cleanBrand = brand.trim();
  if (!cleanBrand) throw new Error('Marca es requerida');

  await pool.query(
    'DELETE FROM device_models WHERE LOWER(brand) = LOWER(?)',
    [cleanBrand]
  );
  return listDeviceOptions();
}
