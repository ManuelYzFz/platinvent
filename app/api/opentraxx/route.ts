import { NextResponse } from "next/server";
import crypto from "crypto";
import { findAccountByUsername } from "@/lib/services/accountService";
import { verifyPassword } from "@/lib/utils/password";
import { createSessionToken } from "@/lib/utils/token";

const API_ORIGIN = process.env.OPENTRAXX_URL ?? "https://opentraxx.cl";
const REQUEST_TIMEOUT_MS = 15_000;

const endpoints: Record<string, string> = {
  vehicles: "StandardApiAction_queryUserVehicle.action",
  devices: "StandardApiAction_getDeviceByVehicle.action",
  online: "StandardApiAction_getDeviceOlStatus.action",
  status: "StandardApiAction_getDeviceStatus.action",
  drivers: "StandardApiAction_findVehicleInfoByDeviceId.action",
  tracks: "StandardApiAction_queryTrackDetail.action",
  alarms: "StandardApiAction_queryAlarmDetail.action",
  media: "StandardApiAction_queryAudioOrVideo.action",
  sims: "StandardApiAction_loadSIMInfos.action",
  areas: "StandardApiAction_getUserMarkers.action",
  loadDevices: "StandardApiAction_getDeviceByVehicle.action",
  mergeCompany: "StandardApiAction_mergeCompany.action",
  mergeDevice: "StandardApiAction_addDevice.action",
  addDevice: "StandardApiAction_addDevice.action",
  addVehicle: "StandardApiAction_addVehicle.action",
  mergeSIMInfo: "StandardApiAction_mergeSIMInfo.action",
  addSIM: "StandardApiAction_mergeSIMInfo.action",
};


type RequestBody = {
  action?: "login" | "query";
  account?: string;
  password?: string;
  session?: string;
  endpoint?: keyof typeof endpoints;
  params?: Record<string, string | number>;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestParams(value: unknown): value is Record<string, string | number> {
  return isRecord(value) && Object.values(value).every((item) =>
    (typeof item === "string" && item.length <= 2000) ||
    (typeof item === "number" && Number.isFinite(item)),
  );
}

function findSession(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  for (const [key, child] of Object.entries(value)) {
    if (/^(jsession|jsessionid|session|token)$/i.test(key) && typeof child === "string" && child) return child;
    const nested = findSession(child);
    if (nested) return nested;
  }
  return "";
}

async function requestOpenTraxx(
  endpoint: string,
  params: Record<string, string | number>,
  method: "GET" | "POST" = "GET"
) {
  let url: URL;
  try {
    url = new URL(`${API_ORIGIN}/${endpoint}`);
  } catch {
    throw new Error("La URL de OpenTraxx no está configurada correctamente");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    let fetchOptions: RequestInit;
    if (method === "POST") {
      const formBody = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => formBody.append(key, String(value)));
      fetchOptions = {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
        signal: controller.signal,
      };
    } else {
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
      fetchOptions = {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      };
    }
    response = await fetch(url, fetchOptions);
    text = await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("OpenTraxx tardó demasiado en responder");
    }
    throw new Error("No se pudo conectar con OpenTraxx");
  } finally {
    clearTimeout(timeout);
  }

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new Error("Formato inválido");
    data = parsed;
  } catch {
    throw new Error(`OpenTraxx devolvió una respuesta no JSON (${response.status})`);
  }
  if (!response.ok || Number(data.result) !== 0) {
    const rawMsg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.msg === "string" && data.msg) ||
      (typeof data.error === "string" && data.error) ||
      "";
    const resultCode = Number(data.result);
    let meaning = "";
    if (resultCode === 1 || resultCode === 2) {
      meaning = "Usuario o contraseña incorrectos";
    } else if (resultCode === 3) {
      meaning = "Cuenta deshabilitada o bloqueada";
    } else if (resultCode === 4) {
      meaning = "Cuenta expirada";
    } else if (resultCode === 11) {
      meaning = "Sesión expirada";
    } else if (resultCode === 13) {
      meaning = "Sin permisos de operación (cuenta sin permisos autorizados en OpenTraxx)";
    }

    console.error(`[OpenTraxx Error]`, { endpoint, result: data.result, rawMsg, responseStatus: response.status });
    const errorMsg = meaning || rawMsg || `Error en la solicitud (${String(data.result ?? `HTTP ${response.status}`)})`;
    throw new Error(errorMsg);
  }
  return data;
}


export async function POST(request: Request) {
  let body: RequestBody;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return jsonError("El cuerpo de la petición debe ser un objeto JSON");
    body = parsed as RequestBody;
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido");
  }

  try {
    if (body.action === "login") {
      if (typeof body.account !== "string" || typeof body.password !== "string" || !body.account.trim() || !body.password) {
        return jsonError("Usuario y contraseña son obligatorios");
      }
      const accountInput = body.account.trim().toLowerCase();

      // 1. Intentar autenticación con tabla accounts de MySQL local
      try {
        const localAccount = await findAccountByUsername(accountInput);
        if (localAccount) {
          const isPasswordValid =
            verifyPassword(body.password, localAccount.password) ||
            verifyPassword(body.password.trim(), localAccount.password) ||
            verifyPassword(body.password.trim().toLowerCase(), localAccount.password);
          if (!isPasswordValid) {
            return jsonError("Usuario o contraseña incorrectos", 401);
          }

          if (localAccount.is_active !== 1) {
            return jsonError("Esta cuenta se encuentra deshabilitada", 403);
          }

          // Generar token de sesión firmado seguro (HMAC-SHA256)
          const session = createSessionToken(localAccount.username, localAccount.role);
          return NextResponse.json({
            session,
            accountName: localAccount.username,
            role: localAccount.role,
            isLocalAccount: true,
          });
        }
      } catch (localAuthError) {
        console.error("[Auth Error] Fallo al verificar cuenta local:", localAuthError);
      }

      // 2. Si no es cuenta local, intentar autenticación con API de OpenTraxx
      const login = await requestOpenTraxx("StandardApiAction_login.action", {
        account: accountInput,
        password: body.password,
      }, "POST");
      const session = findSession(login);
      if (!session) return jsonError("OpenTraxx no devolvió jsession", 502);

      // La consulta de vehículos es complementaria; no debe bloquear el login si la cuenta no tiene permisos de consulta
      let inventory: Record<string, unknown> = {};
      try {
        inventory = await requestOpenTraxx(endpoints.vehicles, { jsession: session, language: "zh" });
      } catch (invError) {
        console.warn("[OpenTraxx] Advertencia al obtener vehículos en login (no bloqueante):", invError);
      }

      return NextResponse.json({
        session,
        accountName: typeof login.account_name === "string" ? login.account_name : accountInput,
        role: "admin", // Cuentas de OpenTraxx ingresan con rol operativo admin
        ...inventory,
      });
    }

    if (body.action === "query") {
      if (typeof body.session !== "string" || !body.session.trim() || !body.endpoint || !endpoints[body.endpoint]) return jsonError("Consulta relacionada incompleta");
      if (body.params !== undefined && !isRequestParams(body.params)) return jsonError("Los parámetros de consulta no son válidos");
      return NextResponse.json(await requestOpenTraxx(endpoints[body.endpoint], { jsession: body.session.trim(), ...(body.params ?? {}) }));
    }

    return jsonError("Acción no soportada");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error consultando OpenTraxx", 502);
  }
}