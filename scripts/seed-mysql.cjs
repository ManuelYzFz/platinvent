const fs = require('fs');
const path = require('path');

// Resuelve la raíz del proyecto independientemente de dónde se ejecute el comando
const projectDir = path.resolve(__dirname, '..');
const mysql = require(path.join(projectDir, 'node_modules', 'mysql2', 'promise'));

// Carga las variables de entorno desde .env si no están presentes
const envPath = path.join(projectDir, '.env');
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (!env[match[1]]) {
        env[match[1]] = value.trim();
      }
    }
  });
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

(async () => {
  console.log('🚀 Iniciando sincronización de datos locales a MySQL...');
  console.log(`Servidor destino: ${env.DB_HOST || 'localhost'} | Base de datos: ${env.DB_NAME}`);

  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.DB_HOST,
      port: Number(env.DB_PORT) || 3306,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME
    });
  } catch (err) {
    console.error('❌ Error conectando a MySQL:', err.message);
    process.exit(1);
  }

  const datosDir = path.join(projectDir, 'datoslocales');

  // =========================================================================
  // 1. EMPRESAS (company.json)
  // =========================================================================
  console.log('\n--- 1. Sincronizando Empresas ---');
  const companyMap = new Map(); // name.toLowerCase() -> id
  const companyFile = path.join(datosDir, 'company.json');
  if (fs.existsSync(companyFile)) {
    const compData = JSON.parse(fs.readFileSync(companyFile, 'utf-8'));
    const companies = compData.companys || compData.companies || [];
    let insertedComp = 0;

    for (const c of companies) {
      const name = (c.name || '').trim();
      if (!name) continue;

      const [existing] = await conn.query('SELECT id FROM companies WHERE LOWER(name) = LOWER(?)', [name]);
      if (existing.length > 0) {
        companyMap.set(name.toLowerCase(), existing[0].id);
      } else {
        const [res] = await conn.query('INSERT INTO companies (name) VALUES (?)', [name]);
        companyMap.set(name.toLowerCase(), res.insertId);
        insertedComp++;
      }
    }
    console.log(`✅ Empresas procesadas: ${companies.length} (${insertedComp} nuevas insertadas, ${companyMap.size} activas)`);
  }

  // =========================================================================
  // 2. VEHICULOS (vehicles.json)
  // =========================================================================
  console.log('\n--- 2. Sincronizando Vehículos ---');
  const vehicleMap = new Map(); // plate.toUpperCase() -> id
  const vehicleFile = path.join(datosDir, 'vehicles.json');
  if (fs.existsSync(vehicleFile)) {
    const vData = JSON.parse(fs.readFileSync(vehicleFile, 'utf-8'));
    const vehicles = vData.infos || vData.vehicles || [];
    let insertedVeh = 0;

    for (const v of vehicles) {
      const plate = (v.vid || v.lp || v.vehiIdno || '').trim().toUpperCase();
      if (!plate) continue;

      const compName = v.com?.name || v.companyName || '';
      let compId = companyMap.get(compName.toLowerCase()) || null;
      if (!compId && compName) {
        const [cRes] = await conn.query('INSERT INTO companies (name) VALUES (?)', [compName]);
        compId = cRes.insertId;
        companyMap.set(compName.toLowerCase(), compId);
      }

      const regDate = parseDate(v.itm || v.itmDate);

      const [existing] = await conn.query('SELECT id FROM vehicles WHERE UPPER(plate_number) = ?', [plate]);
      if (existing.length > 0) {
        vehicleMap.set(plate, existing[0].id);
        if (compId) {
          await conn.query('UPDATE vehicles SET company_id = COALESCE(company_id, ?) WHERE id = ?', [compId, existing[0].id]);
        }
      } else {
        const [res] = await conn.query(
          'INSERT INTO vehicles (plate_number, company_id, registration_date) VALUES (?, ?, ?)',
          [plate, compId, regDate]
        );
        vehicleMap.set(plate, res.insertId);
        insertedVeh++;
      }
    }
    console.log(`✅ Vehículos procesados: ${vehicles.length} (${insertedVeh} nuevos insertados, ${vehicleMap.size} registrados)`);
  }

  // =========================================================================
  // 3. TARJETAS SIM (simCard.json)
  // =========================================================================
  console.log('\n--- 3. Sincronizando Tarjetas SIM ---');
  const simMap = new Map(); // iccid/cardNum -> id
  const simFile = path.join(datosDir, 'simCard.json');
  if (fs.existsSync(simFile)) {
    const sData = JSON.parse(fs.readFileSync(simFile, 'utf-8'));
    const sims = sData.infos || sData.simcards || [];
    let insertedSims = 0;

    for (const s of sims) {
      const iccid = (s.simCard || s.iccid || '').trim();
      const cardNum = (s.cardNum || s.cardNumber || '').trim();
      if (!iccid && !cardNum) continue;

      const compName = s.companyName || '';
      let compId = companyMap.get(compName.toLowerCase()) || null;
      if (!compId && compName) {
        const [cRes] = await conn.query('INSERT INTO companies (name) VALUES (?)', [compName]);
        compId = cRes.insertId;
        companyMap.set(compName.toLowerCase(), compId);
      }

      const status = s.status === 2 ? 0 : Number(s.status) || 1;
      const install = Number(s.install) || 0;
      const planName = s.planName || null;
      const city = s.city || null;
      const cardMerchant = s.cardMerchant || null;
      const msisdn = s.msisdn || null;
      const serviceProvider = s.serviceProvider || s.operator || null;
      const regDate = parseDate(s.registrationTime || s.registrationDate);
      const expDate = parseDate(s.endTime || s.expirationDate);

      const [existing] = await conn.query(
        'SELECT id FROM simcards WHERE (simcard = ? AND simcard <> "") OR (card_number = ? AND card_number <> "") LIMIT 1',
        [iccid || '__none__', cardNum || '__none__']
      );

      let simId;
      if (existing.length > 0) {
        simId = existing[0].id;
      } else {
        const [res] = await conn.query(
          `INSERT INTO simcards (
            simcard, card_number, status, install, plan_name, city, card_merchant, msisdn, service_provider, expiration_date, registration_date, company_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [iccid || null, cardNum || null, status, install, planName, city, cardMerchant, msisdn, serviceProvider, expDate, regDate, compId]
        );
        simId = res.insertId;
        insertedSims++;
      }

      if (iccid) simMap.set(iccid, simId);
      if (cardNum) simMap.set(cardNum, simId);
    }
    console.log(`✅ SIM Cards procesadas: ${sims.length} (${insertedSims} nuevas insertadas)`);
  }

  // =========================================================================
  // 4. DISPOSITIVOS (devices.json)
  // =========================================================================
  console.log('\n--- 4. Sincronizando Dispositivos ---');
  const devFile = path.join(datosDir, 'devices.json');
  if (fs.existsSync(devFile)) {
    const dData = JSON.parse(fs.readFileSync(devFile, 'utf-8'));
    const devices = dData.infos || dData.devices || [];
    let insertedDevs = 0;
    let updatedDevs = 0;

    for (const d of devices) {
      const devidno = (d.devIDNO || d.devidno || '').trim();
      const imei = (d.imei || '').trim();
      const serialId = (d.serialID || d.serial_id || '').trim();
      if (!devidno && !imei) continue;

      const compName = d.companyName || '';
      let compId = companyMap.get(compName.toLowerCase()) || null;
      if (!compId && compName && compName.toLowerCase() !== 'sin asignar') {
        const [cRes] = await conn.query('INSERT INTO companies (name) VALUES (?)', [compName]);
        compId = cRes.insertId;
        companyMap.set(compName.toLowerCase(), compId);
      }

      // Resolve Vehicle
      const plate = (d.vehiIdno || d.vehiIDNO || d.vehiclePlate || '').trim().toUpperCase();
      let vehId = vehicleMap.get(plate) || null;
      if (!vehId && plate && plate !== 'SIN ASIGNAR') {
        const [vRes] = await conn.query('INSERT INTO vehicles (plate_number, company_id) VALUES (?, ?)', [plate, compId]);
        vehId = vRes.insertId;
        vehicleMap.set(plate, vehId);
      }

      // Resolve Simcard
      const simRef = (d.simInfo || d.actualCardNumber || '').trim();
      let simId = simMap.get(simRef) || null;
      if (!simId && simRef && simRef.toLowerCase() !== 'sin asignar') {
        const [sRes] = await conn.query(
          'SELECT id FROM simcards WHERE simcard = ? OR card_number = ? LIMIT 1',
          [simRef, simRef]
        );
        if (sRes.length > 0) {
          simId = sRes[0].id;
        } else {
          const isPhone = /^\d{8,12}$/.test(simRef);
          const [insSim] = await conn.query(
            'INSERT INTO simcards (simcard, card_number, status, install, company_id) VALUES (?, ?, 1, 1, ?)',
            [isPhone ? null : simRef, isPhone ? simRef : null, compId]
          );
          simId = insSim.insertId;
        }
        simMap.set(simRef, simId);
      }

      const brand = (d.brand || 'Sin Asignar').trim();
      const model = (d.model || 'Sin Asignar').trim();
      const devType = Number(d.devType) || 7;
      const install = Number(d.install) || 0;
      const serviceStatus = d.serviceStatus === 'inactive' ? 0 : 1;
      const regDate = parseDate(d.registrationDate);
      const assignDate = parseDate(d.assignmentDate);
      const qrCode = d.qrCode || null;

      // Add to device_models catalog if valid
      if (brand && brand !== 'Sin Asignar' && model && model !== 'Sin Asignar') {
        await conn.query('INSERT IGNORE INTO device_models (brand, model) VALUES (?, ?)', [brand, model]);
      }

      // Check if device already in DB
      const [existing] = await conn.query(
        'SELECT id FROM devices WHERE (devidno = ? AND devidno <> "") OR (imei = ? AND imei <> "") LIMIT 1',
        [devidno || '__none__', imei || '__none__']
      );

      if (existing.length > 0) {
        await conn.query(
          `UPDATE devices SET 
            company_id = COALESCE(?, company_id),
            vehicle_id = COALESCE(?, vehicle_id),
            simcard_id = COALESCE(?, simcard_id),
            brand = CASE WHEN brand IS NULL OR brand = '' OR brand = 'Sin Asignar' THEN ? ELSE brand END,
            model = CASE WHEN model IS NULL OR model = '' OR model = 'Sin Asignar' THEN ? ELSE model END,
            qr_code = COALESCE(?, qr_code)
           WHERE id = ?`,
          [compId, vehId, simId, brand, model, qrCode, existing[0].id]
        );
        updatedDevs++;
      } else {
        await conn.query(
          `INSERT INTO devices (
            devidno, imei, serial_id, brand, model, dev_type, install, service_status, company_id, simcard_id, vehicle_id, registration_date, assignment_date, qr_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [devidno || null, imei || null, serialId || null, brand, model, devType, install, serviceStatus, compId, simId, vehId, regDate, assignDate, qrCode]
        );
        insertedDevs++;
      }
    }
    console.log(`✅ Dispositivos procesados: ${devices.length} (${insertedDevs} nuevos insertados, ${updatedDevs} actualizados con vínculos)`);
  }

  // =========================================================================
  // 5. RESUMEN FINAL
  // =========================================================================
  console.log('\n=========================================');
  console.log('🎉 RECUENTO TOTAL EN BASE DE DATOS:');
  const tables = ['accounts', 'companies', 'vehicles', 'simcards', 'devices', 'device_models'];
  for (const t of tables) {
    const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${t}\``);
    console.log(`- Tabla ${t.padEnd(15)}: ${rows[0].count} registros`);
  }
  console.log('=========================================\n');

  await conn.end();
  console.log('✅ Sincronización completada exitosamente.');
})();
