import type { DeviceRecord, VehicleRecord, VehicleCompany, SimRecord } from '@/lib/types/inventory';

const DB_NAME = 'vtraxx_offline_db';
const DB_VERSION = 1;

export interface SyncMutation {
  id?: number;
  entity: 'device' | 'sim';
  action: 'create' | 'update';
  data: Record<string, unknown>;
  createdAt: number;
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'offline';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no esta disponible en este entorno'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('devices')) {
        db.createObjectStore('devices', { keyPath: 'storageKey' });
      }
      if (!db.objectStoreNames.contains('simcards')) {
        db.createObjectStore('simcards', { keyPath: 'storageKey' });
      }
      if (!db.objectStoreNames.contains('vehicles')) {
        db.createObjectStore('vehicles', { keyPath: 'storageKey' });
      }
      if (!db.objectStoreNames.contains('companies')) {
        db.createObjectStore('companies', { keyPath: 'storageKey' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Guardado y Lectura de Dispositivos
export async function saveOfflineDevices(devices: DeviceRecord[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('devices', 'readwrite');
    const store = tx.objectStore('devices');

    store.clear();
    devices.forEach((dev, index) => {
      const storageKey = String(dev.devIDNO || dev.id || `dev-${index}`);
      store.put({ ...dev, storageKey });
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error guardando dispositivos en IndexedDB:', err);
  }
}

export async function saveSingleOfflineDevice(dev: DeviceRecord): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('devices', 'readwrite');
    const store = tx.objectStore('devices');
    const storageKey = String(dev.devIDNO || dev.id || `dev-${Date.now()}`);
    store.put({ ...dev, storageKey });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error guardando dispositivo individual en IndexedDB:', err);
  }
}

export async function getOfflineDevices(): Promise<DeviceRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('devices', 'readonly');
    const store = tx.objectStore('devices');
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = (request.result || []) as (DeviceRecord & { storageKey?: string })[];
        resolve(results.map(({ storageKey, ...dev }) => dev as DeviceRecord));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Guardado y Lectura de Tarjetas SIM
export async function saveOfflineSims(sims: SimRecord[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('simcards', 'readwrite');
    const store = tx.objectStore('simcards');

    store.clear();
    sims.forEach((sim, index) => {
      const storageKey = String(sim.simCard || sim.id || `sim-${index}`);
      store.put({ ...sim, storageKey });
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error guardando SIMs en IndexedDB:', err);
  }
}

export async function saveSingleOfflineSim(sim: SimRecord): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('simcards', 'readwrite');
    const store = tx.objectStore('simcards');
    const storageKey = String(sim.simCard || sim.id || `sim-${Date.now()}`);
    store.put({ ...sim, storageKey });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error guardando SIM individual en IndexedDB:', err);
  }
}

export async function getOfflineSims(): Promise<SimRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('simcards', 'readonly');
    const store = tx.objectStore('simcards');
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = (request.result || []) as (SimRecord & { storageKey?: string })[];
        resolve(results.map(({ storageKey, ...sim }) => sim as SimRecord));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Guardado y Lectura de Vehiculos
export async function saveOfflineVehicles(vehicles: VehicleRecord[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('vehicles', 'readwrite');
    const store = tx.objectStore('vehicles');

    store.clear();
    vehicles.forEach((veh, index) => {
      const storageKey = String(veh.vid || veh.vehiIdno || `veh-${index}`);
      store.put({ ...veh, storageKey });
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error guardando vehiculos en IndexedDB:', err);
  }
}

export async function getOfflineVehicles(): Promise<VehicleRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('vehicles', 'readonly');
    const store = tx.objectStore('vehicles');
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = (request.result || []) as (VehicleRecord & { storageKey?: string })[];
        resolve(results.map(({ storageKey, ...veh }) => veh as VehicleRecord));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Guardado y Lectura de Empresas
export async function saveOfflineCompanies(companies: VehicleCompany[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('companies', 'readwrite');
    const store = tx.objectStore('companies');

    store.clear();
    companies.forEach((comp, index) => {
      const storageKey = String(comp.id || comp.name || `comp-${index}`);
      store.put({ ...comp, storageKey });
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error guardando empresas en IndexedDB:', err);
  }
}

export async function getOfflineCompanies(): Promise<VehicleCompany[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('companies', 'readonly');
    const store = tx.objectStore('companies');
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = (request.result || []) as (VehicleCompany & { storageKey?: string })[];
        resolve(results.map(({ storageKey, ...comp }) => comp as VehicleCompany));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Cola de Sincronizacion (Sync Queue / Outbox)
export async function enqueueSyncMutation(entity: 'device' | 'sim', action: 'create' | 'update', data: Record<string, unknown>): Promise<number> {
  const db = await openDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const store = tx.objectStore('sync_queue');

  const mutation: SyncMutation = {
    entity,
    action,
    data,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const req = store.add(mutation);
    req.onsuccess = () => {
      notifySyncStatusChange();
      resolve(req.result as number);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSyncMutations(): Promise<SyncMutation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result || []) as SyncMutation[]);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeSyncMutation(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        notifySyncStatusChange();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error eliminando mutacion sincronizada:', err);
  }
}

export async function getPendingCount(): Promise<number> {
  const items = await getPendingSyncMutations();
  return items.length;
}

// Sincronizador en Segundo Plano
let isSyncing = false;

export async function syncPendingChanges(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || typeof navigator === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  if (typeof document !== 'undefined') {
    const currentCookie = document.cookie.match(/(?:^|;\s*)jsession=([^;]*)/);
    const sessionVal = currentCookie ? decodeURIComponent(currentCookie[1]).trim() : '';
    if (!sessionVal || sessionVal.startsWith('offline-')) {
      return { synced: 0, failed: 0 };
    }
  }

  isSyncing = true;
  notifySyncStatusChange('syncing');

  const pending = await getPendingSyncMutations();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    if (!item.id) continue;
    try {
      let res: Response | null = null;
      if (item.entity === 'device') {
        const payload = 'device' in item.data ? item.data : { device: item.data };
        res = await fetch('/api/local-devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (item.entity === 'sim') {
        const payload = 'sim' in item.data ? item.data : { sim: item.data };
        res = await fetch('/api/local-sims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res) {
        if (res.ok) {
          await removeSyncMutation(item.id);
          synced++;
        } else if (res.status === 401) {
          console.warn(`Sync pospuesta: sesión no autorizada (401). Se reintentará al autenticar.`);
          failed++;
          break; // Detener loop, sesión no válida
        } else if (res.status === 400 || res.status === 409 || res.status === 422) {
          console.warn(`Item #${item.id} descartado por error irrecuperable (${res.status}).`);
          await removeSyncMutation(item.id);
          failed++;
        } else {
          failed++;
        }
      }
    } catch (err) {
      console.warn(`Error sincronizando item #${item.id}:`, err);
      failed++;
    }
  }

  isSyncing = false;
  notifySyncStatusChange();

  if (synced > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vtraxx-data-synchronized', { detail: { synced } }));
  }

  return { synced, failed };
}

export function notifySyncStatusChange(forcedStatus?: SyncStatus) {
  if (typeof window === 'undefined') return;

  getPendingCount().then((count) => {
    const isOffline = !navigator.onLine;
    let status: SyncStatus = 'synced';
    if (isOffline) {
      status = 'offline';
    } else if (forcedStatus === 'syncing' || isSyncing) {
      status = 'syncing';
    } else if (count > 0) {
      status = 'pending';
    }

    window.dispatchEvent(
      new CustomEvent('vtraxx-sync-status', {
        detail: { count, status, isOffline },
      })
    );
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifySyncStatusChange();
    void syncPendingChanges();
  });

  window.addEventListener('offline', () => {
    notifySyncStatusChange('offline');
  });
}