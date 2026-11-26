export type WaterStatus = 'Excelente' | 'Atenção' | 'Crítico'

export interface SensorReading {
  id: string
  timestamp: string // ISO string
  ph: number
  turbidity: number // UNT
  temperature: number // °C
  reservoirLevel: number // 0-100 %
}

export interface Well {
  id: string
  code: string
  name: string
  community: string
  sector: string
  latitude: number
  longitude: number
  affectedFamilies: number
  reservoirLevel: number // %
  currentReading: {
    ph: number
    turbidity: number
    temperature: number
  }
  lastTransmissionMinutesAgo: number
  lastMaintenanceDate: string // YYYY-MM-DD
  nextMaintenanceDate: string // YYYY-MM-DD
  interdicted?: boolean
  interdictionReason?: string
  history: SensorReading[]
}

export interface FieldVisit {
  id: string
  wellId: string
  wellName: string
  location: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime: string // HH:mm
  priority: 'Alta' | 'Média' | 'Normal'
  reason: string
  assignedInspector: string
  recentSummary: string
  status: 'Agendada' | 'Em Andamento' | 'Concluída'
  createdAt: string
}

export type MaintenanceType =
  | 'Troca de Mídia Filtrante'
  | 'Calibração de Sensores'
  | 'Substituição de Sensores Eletrônicos'
  | 'Manutenção Preventiva / Corretiva Geral'

export type FilterMediaElement =
  | 'Areia de Quartzo'
  | 'Pedregulho / Cascalho de Sustentação'
  | 'Carvão Ativado Granulado'

export type SensorType = 'pH' | 'Turbidez' | 'Temperatura'

export interface MaintenanceRecord {
  id: string
  wellId: string
  wellName: string
  type: MaintenanceType
  filterElement?: FilterMediaElement
  filterVolume?: string
  sensorType?: SensorType
  calibrationDateTime?: string
  bufferSolution?: string
  readingBefore?: string
  readingAfter?: string
  notes: string
  photoName: string
  photoDataUrl: string
  gpsCoords: {
    latitude: number
    longitude: number
  }
  inspectorName: string
  createdAt: string
}

export interface TechnicalBulletin {
  id: string
  protocolCode: string
  wellId: string
  wellName: string
  community: string
  coordinates: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string // YYYY-MM-DD
  issuerId: string
  issuerName: string
  integrityHash: string
  readingsCount: number
  criticalAlertsCount: number
  maintenancesCount: number
  generatedAt: string
}

export type AnnouncementCategory = 'Alerta Operacional' | 'Educação Sanitária'
export type AnnouncementPriority = 'Crítico' | 'Agendado' | 'Educativo'

export interface Announcement {
  id: string
  title: string
  category: AnnouncementCategory
  priority: AnnouncementPriority
  summary: string
  body: string
  steps?: string[]
  wellName?: string
  scheduleWindow?: string
  publishedAt: string
  read: boolean
}

export type OmbudsmanCategory =
  | 'Alteração de Odor'
  | 'Alteração de Coloração / Turbidez'
  | 'Vazamento ou Dano Físico'
  | 'Sabor Estranho na Água'
  | 'Interrupção Inesperada no Fluxo'

export type OmbudsmanStatus =
  | 'Registrado'
  | 'Em Análise Técnica'
  | 'Visita Agendada'
  | 'Concluído'

export interface OmbudsmanTicket {
  id: string
  protocolCode: string
  wellId: string
  wellName: string
  category: OmbudsmanCategory
  description: string
  photos: { name: string; dataUrl: string }[]
  gpsCoords?: { latitude: number; longitude: number }
  status: OmbudsmanStatus
  ongNotes?: string
  createdAt: string
}

export type EmergencyCategory =
  | 'Desabastecimento Total'
  | 'Vazamento Grave / Rompimento de Adutora'
  | 'Contaminação Visível / Riscos à Saúde'
  | 'Vandalismo ou Dano Físico Severo'

export interface EmergencyReport {
  id: string
  protocolCode: string
  wellId: string
  wellName: string
  category: EmergencyCategory
  description: string
  affectedFamilies: number
  photos: { name: string; dataUrl: string }[]
  audioLabel?: string
  gpsCoords: { latitude: number; longitude: number }
  slaHours: number
  notifiedChannels: string[]
  status: 'Em Atendimento' | 'Resolvida'
  createdAt: string
}

export interface WorkshopParticipant {
  name: string
  status: 'confirmed' | 'waitlist'
  checkedIn: boolean
  joinedAt: string
}

export interface Workshop {
  id: string
  title: string
  agenda: string
  facilitator: string
  dateTime: string // YYYY-MM-DDTHH:mm
  location: string
  maxSeats: number
  participants: WorkshopParticipant[]
  createdAt: string
}

export interface IotTelemetryPoint {
  label: string
  batteryPct: number
  rssiDbm: number
}

export interface IotDeviceHealth {
  id: string
  nodeId: string
  wellId: string
  wellName: string
  protocol: 'LoRaWAN' | 'Cellular 4G'
  firmwareVersion: string
  batteryPct: number
  solarVoltage: number
  rssiDbm: number
  packetLossPct: number
  lastHeartbeatMinutesAgo: number
  series24h: IotTelemetryPoint[]
  rawPayloadHex: string
  rawPayloadJson: string
}

export type HardwareComponentType =
  | 'Placa Microcontroladora (ESP32 / STM32)'
  | 'Módulo de Comunicação (LoRaWAN / Cellular / Satellite)'
  | 'Sensores de Qualidade (pH / Turbidez / Temp.)'
  | 'Sistema de Alimentação (Bateria LiFePO4 / Solar)'

export interface CalibrationRecord {
  id: string
  wellId: string
  wellName: string
  sensor: 'pH' | 'Turbidez'
  offset: number
  slopePct?: number
  bufferReference: string
  serialNumber: string
  firmwareVersion: string
  technicianId: string
  version: number
  createdAt: string
}

export interface HardwareSwapRecord {
  id: string
  wellId: string
  wellName: string
  componentType: HardwareComponentType
  serialNumber: string
  firmwareVersion: string
  notes: string
  technicianId: string
  createdAt: string
}

export type PlatformRole =
  | 'Administrador TI'
  | 'Fiscal / Agente de Campo'
  | 'Analista Sanitário'
  | 'Liderança Comunitária'
  | 'Morador'

export type UserAccountStatus = 'Ativo' | 'Inativo / Bloqueado'

export interface PlatformUser {
  id: string
  name: string
  email: string
  role: PlatformRole
  status: UserAccountStatus
  activeSessions: number
  createdAt: string
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  actorId: string
  ipAddress: string
  action: string
  targetEmail: string
  details: string
}
