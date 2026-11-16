export interface DeviceRecord {
  id?: string | number;
  devIDNO?: string;
  companyId?: string | number | null;
  companyID?: string | number | null;
  companyName?: string | null;
  devType?: string | number;
  type?: string | number;
  serialID?: string | null;
  imei?: string | null;
  qrCode?: string | null;
  actualCardNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  install?: number | string | boolean;
  serviceStatus?: 'active' | 'inactive' | string | null;
  assignmentDate?: string | null;
  registrationDate?: string | null;
  stlTm?: number | null;
  stlTmStr?: string | null;
  vehiIdno?: string | null;
  vehiIDNO?: string | null;
  vid?: string | number | null;
  simInfo?: string | null;
  sim?: string | null;
  cardNum?: string | null;
  chnName?: string | null;
  stlTmEx?: number | null;
  stlTmExStr?: string | null;
  factoryDevType?: string | number | null;
  factoryType?: string | number | null;
  checkStatus?: string | number | null;
  checkTime?: number | null;
  checkTimeStr?: string | null;
  ifMainDefense?: number | null;
  [key: string]: unknown;
}

export interface VehicleCompany {
  id?: string | number;
  name?: string;
  parentId?: number;
  level?: number;
  companyId?: string | number;
  companyName?: string;
  linkMan?: string;
}

export interface VehicleDeviceItem {
  id?: string;
  name?: string;
  devIDNO?: string;
  simInfo?: string;
  serialID?: string;
  actualCardNumber?: string;
}

export interface VehicleRecord {
  id?: number;
  vid?: string;
  vehiIdno?: string;
  com?: VehicleCompany;
  companyId?: string | number;
  companyName?: string;
  pnm?: string;
  pid?: number;
  name?: string;
  devList?: VehicleDeviceItem[] | null;
  dl?: VehicleDeviceItem[] | null;
  stu?: number;
  ptp?: number;
  ol?: number;
  tm?: string | null;
  itm?: string | null;
  stm?: string | null;
  [key: string]: unknown;
}

export interface SimCompany {
  id?: number;
  name?: string;
  companyId?: number;
  companyName?: string;
}

export interface SimRecord {
  id?: number;
  cardNum?: string;
  status?: number;
  registrationTime?: number | string;
  remark?: string | null;
  updateTime?: number | null;
  install?: number;
  devIDNO?: string | null;
  vehiIDNO?: string | null;
  companyID?: number;
  simCard?: string | null;
  companyName?: string;
  serviceProvider?: string | null;
  planName?: string | null;
  city?: string | null;
  operator?: string | null;
  devId?: string | number | null;
  oldDevId?: string | number | null;
  endTime?: number | string | null;
  cardMerchant?: string | null;
  msisdn?: string | null;
  company?: SimCompany | null;
  [key: string]: unknown;
}

// ─── Tipos compartidos para Módulo de Reportes e Informes ─────────────────────

/** Ticket/reporte de error de dispositivo */
export interface ReportItem {
  id: number;
  devIdno: string;
  companyId?: number | string;
  brand?: string;
  model?: string;
  plateNumber: string;
  asunto?: string;
  prioridad?: string;
  mensaje?: string;
  description?: string;
  typeError: string;
  fechaHora?: string;
}

/** Compañía simplificada para listados */
export interface CompanyItem {
  id: number | string;
  name: string;
}
