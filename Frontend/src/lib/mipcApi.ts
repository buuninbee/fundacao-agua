import { supabase } from '@/lib/supabase'
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
  AuditLogEntry,
  CalibrationRecord,
  EmergencyCategory,
  EmergencyReport,
  FieldVisit,
  FilterMediaElement,
  HardwareComponentType,
  HardwareSwapRecord,
  IotDeviceHealth,
  IotTelemetryPoint,
  MaintenanceRecord,
  MaintenanceType,
  OmbudsmanCategory,
  OmbudsmanStatus,
  OmbudsmanTicket,
  PlatformRole,
  PlatformUser,
  SensorReading,
  SensorType,
  TechnicalBulletin,
  UserAccountStatus,
  Well,
  Workshop,
  WorkshopParticipant,
} from '@/types/mipc'

export interface MipcDataSnapshot {
  wells: Well[]
  visits: FieldVisit[]
  maintenances: MaintenanceRecord[]
  bulletins: TechnicalBulletin[]
  announcements: Announcement[]
  tickets: OmbudsmanTicket[]
  emergencies: EmergencyReport[]
  workshops: Workshop[]
  iotDevices: IotDeviceHealth[]
  calibrations: CalibrationRecord[]
  hardwareSwaps: HardwareSwapRecord[]
  users: PlatformUser[]
  auditLogs: AuditLogEntry[]
}

const VALID_ROLES: PlatformRole[] = [
  'Administrador TI',
  'Fiscal / Agente de Campo',
  'Analista Sanitário',
  'Liderança Comunitária',
  'Morador',
]

function normalizeRole(perfil: string | null | undefined): PlatformRole {
  if (!perfil) return 'Morador'
  if (VALID_ROLES.includes(perfil as PlatformRole)) return perfil as PlatformRole
  const upper = perfil.toUpperCase()
  if (upper.includes('ADMIN')) return 'Administrador TI'
  if (upper.includes('AGENTE') || upper.includes('FISCAL')) return 'Fiscal / Agente de Campo'
  if (upper.includes('ANALISTA')) return 'Analista Sanitário'
  if (upper.includes('LIDER')) return 'Liderança Comunitária'
  return 'Morador'
}

function parsePocoId(wellId: string | undefined): number | null {
  if (!wellId) return null
  const num = Number(wellId)
  return Number.isInteger(num) && num > 0 ? num : null
}

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 999
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return 999
  return Math.max(0, Math.round((Date.now() - ms) / 60000))
}

function ensureOk<T>(res: { data: T; error: { message: string } | null }, label: string): T {
  if (res.error) {
    throw new Error(`Supabase (${label}): ${res.error.message}`)
  }
  return res.data
}

export async function fetchAllMipcData(): Promise<MipcDataSnapshot> {
  const [
    pocosRes,
    leiturasRes,
    visitasRes,
    manutencoesRes,
    boletinsRes,
    comunicadosRes,
    ouvidoriaRes,
    emergenciasRes,
    workshopsRes,
    dispositivosRes,
    calibracoesRes,
    trocasRes,
    usuariosRes,
    auditoriaRes,
  ] = await Promise.all([
    supabase.from('pocos').select('*').order('id', { ascending: true }),
    supabase.from('leituras_iot').select('*').order('created_at', { ascending: true }),
    supabase.from('visitas_tecnicas').select('*').order('created_at', { ascending: false }),
    supabase.from('manutencoes').select('*').order('created_at', { ascending: false }),
    supabase.from('boletins_tecnicos').select('*').order('gerado_em', { ascending: false }),
    supabase.from('comunicados').select('*').order('publicado_em', { ascending: false }),
    supabase.from('ouvidoria_chamados').select('*').order('created_at', { ascending: false }),
    supabase.from('emergencias').select('*').order('created_at', { ascending: false }),
    supabase.from('workshops').select('*').order('created_at', { ascending: false }),
    supabase.from('dispositivos_iot').select('*').order('created_at', { ascending: true }),
    supabase.from('calibracoes').select('*').order('created_at', { ascending: false }),
    supabase.from('trocas_hardware').select('*').order('created_at', { ascending: false }),
    supabase.from('usuarios').select('*').order('created_at', { ascending: false }),
    supabase.from('auditoria_logs').select('*').order('timestamp', { ascending: false }),
  ])

  const pocosRows = ensureOk(pocosRes, 'pocos') ?? []
  const leiturasRows = ensureOk(leiturasRes, 'leituras_iot') ?? []
  const visitasRows = ensureOk(visitasRes, 'visitas_tecnicas') ?? []
  const manutencoesRows = ensureOk(manutencoesRes, 'manutencoes') ?? []
  const boletinsRows = ensureOk(boletinsRes, 'boletins_tecnicos') ?? []
  const comunicadosRows = ensureOk(comunicadosRes, 'comunicados') ?? []
  const ouvidoriaRows = ensureOk(ouvidoriaRes, 'ouvidoria_chamados') ?? []
  const emergenciasRows = ensureOk(emergenciasRes, 'emergencias') ?? []
  const workshopsRows = ensureOk(workshopsRes, 'workshops') ?? []
  const dispositivosRows = ensureOk(dispositivosRes, 'dispositivos_iot') ?? []
  const calibracoesRows = ensureOk(calibracoesRes, 'calibracoes') ?? []
  const trocasRows = ensureOk(trocasRes, 'trocas_hardware') ?? []
  const usuariosRows = ensureOk(usuariosRes, 'usuarios') ?? []
  const auditoriaRows = ensureOk(auditoriaRes, 'auditoria_logs') ?? []

  // Group sensor readings by poco id
  const readingsByPoco = new Map<number, SensorReading[]>()
  for (const r of leiturasRows) {
    if (r.id_poco == null) continue
    const list = readingsByPoco.get(r.id_poco) ?? []
    list.push({
      id: String(r.id),
      timestamp: r.data_enviado ?? r.created_at,
      ph: Number(r.ph ?? 7.0),
      turbidity: Number(r.turbidez ?? 1.0),
      temperature: Number(r.temperatura ?? 22.0),
      reservoirLevel: Number(r.nivel_reservatorio ?? 75),
    })
    readingsByPoco.set(r.id_poco, list)
  }

  const today = new Date().toISOString().slice(0, 10)
  const pocoNameById = new Map<number, string>()

  const wells: Well[] = pocosRows.map((p) => {
    const idNum = Number(p.id)
    const name = p.nome_unidade?.trim() || `Poço #${idNum}`
    pocoNameById.set(idNum, name)
    const history = (readingsByPoco.get(idNum) ?? []).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    const latest = history[history.length - 1]
    return {
      id: String(idNum),
      code: p.codigo ?? `POCO-${String(idNum).padStart(3, '0')}`,
      name,
      community: p.comunidade ?? 'Assentamento Santa Luzia',
      sector: p.setor ?? p.endereco ?? 'Setor Geral',
      latitude: Number(p.latitude ?? -15.79),
      longitude: Number(p.longitude ?? -47.99),
      affectedFamilies: Number(p.familias_afetadas ?? 500),
      reservoirLevel: latest ? latest.reservoirLevel : Number(p.nivel_reservatorio ?? 75),
      currentReading: latest
        ? {
            ph: latest.ph,
            turbidity: latest.turbidity,
            temperature: latest.temperature,
          }
        : { ph: 7.0, turbidity: 1.0, temperature: 22.0 },
      lastTransmissionMinutesAgo: latest ? minutesSince(latest.timestamp) : 999,
      lastMaintenanceDate: p.ultima_manutencao ?? today,
      nextMaintenanceDate: p.proxima_manutencao ?? today,
      interdicted: Boolean(p.interditado),
      interdictionReason: p.motivo_interdicao ?? undefined,
      history,
    }
  })

  const visits: FieldVisit[] = visitasRows.map((v) => {
    const scheduledIso = v.data_agendada ? String(v.data_agendada) : ''
    const scheduledDate = scheduledIso ? scheduledIso.slice(0, 10) : today
    return {
      id: String(v.id),
      wellId: v.poco_id != null ? String(v.poco_id) : '',
      wellName: v.nome_poco ?? (v.poco_id != null ? pocoNameById.get(v.poco_id) ?? `Poço #${v.poco_id}` : 'Poço'),
      location: v.localizacao ?? '',
      scheduledDate,
      scheduledTime: v.horario_agendado ?? (scheduledIso.length >= 16 ? scheduledIso.slice(11, 16) : '09:00'),
      priority: (v.prioridade as FieldVisit['priority']) ?? 'Normal',
      reason: v.motivo_visita ?? '',
      assignedInspector: v.inspetor_responsavel ?? 'Equipe de Campo',
      recentSummary: v.resumo_recente ?? v.observacoes_tecnicas ?? '',
      status: (v.status as FieldVisit['status']) ?? 'Agendada',
      createdAt: v.created_at,
    }
  })

  const maintenances: MaintenanceRecord[] = manutencoesRows.map((m) => ({
    id: String(m.id),
    wellId: m.poco_id != null ? String(m.poco_id) : '',
    wellName: m.nome_poco,
    type: m.tipo as MaintenanceType,
    filterElement: (m.elemento_filtrante as FilterMediaElement | null) ?? undefined,
    filterVolume: m.volume_filtro ?? undefined,
    sensorType: (m.tipo_sensor as SensorType | null) ?? undefined,
    calibrationDateTime: m.data_hora_calibracao ?? undefined,
    bufferSolution: m.solucao_tampao ?? undefined,
    readingBefore: m.leitura_antes ?? undefined,
    readingAfter: m.leitura_depois ?? undefined,
    notes: m.observacoes ?? '',
    photoName: m.foto_nome ?? '',
    photoDataUrl: m.foto_data_url ?? '',
    gpsCoords: {
      latitude: Number(m.gps_latitude ?? 0),
      longitude: Number(m.gps_longitude ?? 0),
    },
    inspectorName: m.nome_inspetor,
    createdAt: m.created_at,
  }))

  const bulletins: TechnicalBulletin[] = boletinsRows.map((b) => ({
    id: String(b.id),
    protocolCode: b.codigo_protocolo,
    wellId: b.poco_id != null ? String(b.poco_id) : '',
    wellName: b.nome_poco,
    community: b.comunidade,
    coordinates: b.coordenadas,
    periodStart: b.periodo_inicio,
    periodEnd: b.periodo_fim,
    issuerId: b.emissor_id,
    issuerName: b.emissor_nome,
    integrityHash: b.hash_integridade,
    readingsCount: Number(b.total_leituras ?? 0),
    criticalAlertsCount: Number(b.total_alertas_criticos ?? 0),
    maintenancesCount: Number(b.total_manutencoes ?? 0),
    generatedAt: b.gerado_em,
  }))

  const announcements: Announcement[] = comunicadosRows.map((a) => ({
    id: String(a.id),
    title: a.titulo,
    category: a.categoria as AnnouncementCategory,
    priority: a.prioridade as AnnouncementPriority,
    summary: a.resumo,
    body: a.corpo,
    steps: Array.isArray(a.passos) ? (a.passos as string[]) : undefined,
    wellName: a.nome_poco ?? undefined,
    scheduleWindow: a.janela_agendamento ?? undefined,
    publishedAt: a.publicado_em,
    read: Boolean(a.lido),
  }))

  const tickets: OmbudsmanTicket[] = ouvidoriaRows.map((t) => ({
    id: String(t.id),
    protocolCode: t.codigo_protocolo,
    wellId: t.poco_id != null ? String(t.poco_id) : '',
    wellName: t.nome_poco,
    category: t.categoria as OmbudsmanCategory,
    description: t.descricao,
    photos: Array.isArray(t.fotos) ? (t.fotos as { name: string; dataUrl: string }[]) : [],
    gpsCoords:
      t.gps_latitude != null && t.gps_longitude != null
        ? { latitude: Number(t.gps_latitude), longitude: Number(t.gps_longitude) }
        : undefined,
    status: t.status as OmbudsmanStatus,
    ongNotes: t.notas_ong ?? undefined,
    createdAt: t.created_at,
  }))

  const emergencies: EmergencyReport[] = emergenciasRows.map((e) => ({
    id: String(e.id),
    protocolCode: e.codigo_protocolo,
    wellId: e.poco_id != null ? String(e.poco_id) : '',
    wellName: e.nome_poco,
    category: e.categoria as EmergencyCategory,
    description: e.descricao ?? '',
    affectedFamilies: Number(e.familias_afetadas ?? 0),
    photos: Array.isArray(e.fotos) ? (e.fotos as { name: string; dataUrl: string }[]) : [],
    audioLabel: e.audio_label ?? undefined,
    gpsCoords: {
      latitude: Number(e.gps_latitude ?? 0),
      longitude: Number(e.gps_longitude ?? 0),
    },
    slaHours: Number(e.sla_horas ?? 2),
    notifiedChannels: Array.isArray(e.canais_notificados)
      ? (e.canais_notificados as string[])
      : ['Push', 'E-mail prioritário', 'SMS'],
    status: (e.status as EmergencyReport['status']) ?? 'Em Atendimento',
    createdAt: e.created_at,
  }))

  const workshops: Workshop[] = workshopsRows.map((w) => ({
    id: String(w.id),
    title: w.titulo,
    agenda: w.pauta,
    facilitator: w.facilitador,
    dateTime: w.data_hora,
    location: w.local,
    maxSeats: Number(w.vagas_max ?? 25),
    participants: Array.isArray(w.participantes)
      ? (w.participantes as WorkshopParticipant[])
      : [],
    createdAt: w.created_at,
  }))

  const iotDevices: IotDeviceHealth[] = dispositivosRows.map((d) => ({
    id: String(d.id),
    nodeId: d.node_id,
    wellId: d.poco_id != null ? String(d.poco_id) : '',
    wellName: d.nome_poco,
    protocol: (d.protocolo as IotDeviceHealth['protocol']) ?? 'LoRaWAN',
    firmwareVersion: d.versao_firmware,
    batteryPct: Number(d.bateria_pct ?? 80),
    solarVoltage: Number(d.tensao_solar ?? 13.0),
    rssiDbm: Number(d.rssi_dbm ?? -80),
    packetLossPct: Number(d.perda_pacotes_pct ?? 0),
    lastHeartbeatMinutesAgo: Number(d.ultimo_heartbeat_minutos ?? 5),
    series24h: Array.isArray(d.series_24h) ? (d.series_24h as IotTelemetryPoint[]) : [],
    rawPayloadHex: d.payload_raw_hex ?? '',
    rawPayloadJson: d.payload_raw_json ?? '{}',
  }))

  const calibrations: CalibrationRecord[] = calibracoesRows.map((c) => ({
    id: String(c.id),
    wellId: c.poco_id != null ? String(c.poco_id) : '',
    wellName: c.nome_poco,
    sensor: c.sensor as CalibrationRecord['sensor'],
    offset: Number(c.offset_valor ?? 0),
    slopePct: c.slope_pct != null ? Number(c.slope_pct) : undefined,
    bufferReference: c.solucao_referencia,
    serialNumber: c.numero_serie,
    firmwareVersion: c.versao_firmware,
    technicianId: c.tecnico_id,
    version: Number(c.versao ?? 1),
    createdAt: c.created_at,
  }))

  const hardwareSwaps: HardwareSwapRecord[] = trocasRows.map((h) => ({
    id: String(h.id),
    wellId: h.poco_id != null ? String(h.poco_id) : '',
    wellName: h.nome_poco,
    componentType: h.tipo_componente as HardwareComponentType,
    serialNumber: h.numero_serie,
    firmwareVersion: h.versao_firmware,
    notes: h.observacoes ?? '',
    technicianId: h.tecnico_id,
    createdAt: h.created_at,
  }))

  const users: PlatformUser[] = usuariosRows.map((u) => ({
    id: String(u.id),
    name: u.nome ?? 'Usuário',
    email: u.email ?? '',
    role: normalizeRole(u.perfil),
    status: (u.status === 'Inativo / Bloqueado' ? 'Inativo / Bloqueado' : 'Ativo') as UserAccountStatus,
    activeSessions: Number(u.sessoes_ativas ?? 0),
    createdAt: u.created_at,
  }))

  const auditLogs: AuditLogEntry[] = auditoriaRows.map((a) => ({
    id: String(a.id),
    timestamp: a.timestamp,
    actorId: a.ator_id,
    ipAddress: a.endereco_ip,
    action: a.acao,
    targetEmail: a.email_alvo,
    details: a.detalhes,
  }))

  return {
    wells,
    visits,
    maintenances,
    bulletins,
    announcements,
    tickets,
    emergencies,
    workshops,
    iotDevices,
    calibrations,
    hardwareSwaps,
    users,
    auditLogs,
  }
}

export async function insertVisitDb(visit: FieldVisit): Promise<string> {
  const scheduledTimestamp =
    /^\d{4}-\d{2}-\d{2}$/.test(visit.scheduledDate) && /^\d{2}:\d{2}$/.test(visit.scheduledTime)
      ? `${visit.scheduledDate}T${visit.scheduledTime}:00-03:00`
      : `${visit.scheduledDate}T09:00:00-03:00`

  const res = await supabase
    .from('visitas_tecnicas')
    .insert({
      poco_id: parsePocoId(visit.wellId),
      nome_poco: visit.wellName,
      localizacao: visit.location,
      data_agendada: scheduledTimestamp,
      horario_agendado: visit.scheduledTime,
      prioridade: visit.priority,
      motivo_visita: visit.reason,
      inspetor_responsavel: visit.assignedInspector,
      resumo_recente: visit.recentSummary,
      observacoes_tecnicas: visit.recentSummary,
      status: visit.status,
    })
    .select('id')
    .single()
  const row = ensureOk(res, 'insert visitas_tecnicas')
  if (!row) throw new Error('Supabase (insert visitas_tecnicas): resposta vazia')
  return String(row.id)
}

export async function updateVisitStatusDb(visitId: string, status: FieldVisit['status']) {
  const idNum = Number(visitId)
  if (!Number.isInteger(idNum)) return
  const res = await supabase.from('visitas_tecnicas').update({ status }).eq('id', idNum)
  ensureOk(res, 'update visitas_tecnicas')
}

export async function insertMaintenanceDb(
  record: MaintenanceRecord,
  todayDate: string,
  nextCycleDate: string,
) {
  const pocoId = parsePocoId(record.wellId)
  const res = await supabase.from('manutencoes').insert({
    id: record.id,
    poco_id: pocoId,
    nome_poco: record.wellName,
    tipo: record.type,
    elemento_filtrante: record.filterElement ?? null,
    volume_filtro: record.filterVolume ?? null,
    tipo_sensor: record.sensorType ?? null,
    data_hora_calibracao: record.calibrationDateTime ?? null,
    solucao_tampao: record.bufferSolution ?? null,
    leitura_antes: record.readingBefore ?? null,
    leitura_depois: record.readingAfter ?? null,
    observacoes: record.notes,
    foto_nome: record.photoName,
    foto_data_url: record.photoDataUrl,
    gps_latitude: record.gpsCoords.latitude,
    gps_longitude: record.gpsCoords.longitude,
    nome_inspetor: record.inspectorName,
    created_at: record.createdAt,
  })
  ensureOk(res, 'insert manutencoes')

  if (pocoId != null) {
    const wellRes = await supabase
      .from('pocos')
      .update({ ultima_manutencao: todayDate, proxima_manutencao: nextCycleDate })
      .eq('id', pocoId)
    ensureOk(wellRes, 'update pocos maintenance dates')
  }
}

export async function insertBulletinDb(bulletin: TechnicalBulletin) {
  const res = await supabase.from('boletins_tecnicos').insert({
    id: bulletin.id,
    codigo_protocolo: bulletin.protocolCode,
    poco_id: parsePocoId(bulletin.wellId),
    nome_poco: bulletin.wellName,
    comunidade: bulletin.community,
    coordenadas: bulletin.coordinates,
    periodo_inicio: bulletin.periodStart,
    periodo_fim: bulletin.periodEnd,
    emissor_id: bulletin.issuerId,
    emissor_nome: bulletin.issuerName,
    hash_integridade: bulletin.integrityHash,
    total_leituras: bulletin.readingsCount,
    total_alertas_criticos: bulletin.criticalAlertsCount,
    total_manutencoes: bulletin.maintenancesCount,
    gerado_em: bulletin.generatedAt,
  })
  ensureOk(res, 'insert boletins_tecnicos')
}

export async function insertAnnouncementDb(announcement: Announcement) {
  const res = await supabase.from('comunicados').insert({
    id: announcement.id,
    titulo: announcement.title,
    categoria: announcement.category,
    prioridade: announcement.priority,
    resumo: announcement.summary,
    corpo: announcement.body,
    passos: announcement.steps ?? null,
    nome_poco: announcement.wellName ?? null,
    janela_agendamento: announcement.scheduleWindow ?? null,
    lido: announcement.read,
    publicado_em: announcement.publishedAt,
  })
  ensureOk(res, 'insert comunicados')
}

export async function markAnnouncementReadDb(announcementId: string) {
  const res = await supabase
    .from('comunicados')
    .update({ lido: true })
    .eq('id', announcementId)
  ensureOk(res, 'update comunicados')
}

export async function insertOmbudsmanTicketDb(ticket: OmbudsmanTicket) {
  const res = await supabase.from('ouvidoria_chamados').insert({
    id: ticket.id,
    codigo_protocolo: ticket.protocolCode,
    poco_id: parsePocoId(ticket.wellId),
    nome_poco: ticket.wellName,
    categoria: ticket.category,
    descricao: ticket.description,
    fotos: ticket.photos,
    gps_latitude: ticket.gpsCoords?.latitude ?? null,
    gps_longitude: ticket.gpsCoords?.longitude ?? null,
    status: ticket.status,
    notas_ong: ticket.ongNotes ?? null,
    created_at: ticket.createdAt,
  })
  ensureOk(res, 'insert ouvidoria_chamados')
}

export async function insertEmergencyDb(
  report: EmergencyReport,
  announcement: Announcement,
  visit: FieldVisit,
  interdictionReason: string,
): Promise<string> {
  const pocoId = parsePocoId(report.wellId)
  const emRes = await supabase.from('emergencias').insert({
    id: report.id,
    codigo_protocolo: report.protocolCode,
    poco_id: pocoId,
    nome_poco: report.wellName,
    categoria: report.category,
    descricao: report.description,
    familias_afetadas: report.affectedFamilies,
    fotos: report.photos,
    audio_label: report.audioLabel ?? null,
    gps_latitude: report.gpsCoords.latitude,
    gps_longitude: report.gpsCoords.longitude,
    sla_horas: report.slaHours,
    canais_notificados: report.notifiedChannels,
    status: report.status,
    created_at: report.createdAt,
  })
  ensureOk(emRes, 'insert emergencias')

  const [visitDbId] = await Promise.all([
    insertVisitDb(visit),
    insertAnnouncementDb(announcement),
    pocoId != null
      ? supabase
          .from('pocos')
          .update({ interditado: true, motivo_interdicao: interdictionReason })
          .eq('id', pocoId)
          .then((r) => ensureOk(r, 'update pocos interdicted'))
      : Promise.resolve(),
  ])

  return visitDbId
}

export async function resolveEmergencyDb(emergencyId: string, wellId?: string) {
  const emRes = await supabase
    .from('emergencias')
    .update({ status: 'Resolvida' })
    .eq('id', emergencyId)
  ensureOk(emRes, 'update emergencias')

  const pocoId = parsePocoId(wellId)
  if (pocoId != null) {
    const wellRes = await supabase
      .from('pocos')
      .update({ interditado: false, motivo_interdicao: null })
      .eq('id', pocoId)
    ensureOk(wellRes, 'clear pocos interdicted')
  }
}

export async function insertWorkshopDb(workshop: Workshop, invite: Announcement) {
  const wkRes = await supabase.from('workshops').insert({
    id: workshop.id,
    titulo: workshop.title,
    pauta: workshop.agenda,
    facilitador: workshop.facilitator,
    data_hora: workshop.dateTime,
    local: workshop.location,
    vagas_max: workshop.maxSeats,
    participantes: workshop.participants,
    created_at: workshop.createdAt,
  })
  ensureOk(wkRes, 'insert workshops')
  await insertAnnouncementDb(invite)
}

export async function updateWorkshopParticipantsDb(
  workshopId: string,
  participants: WorkshopParticipant[],
) {
  const res = await supabase
    .from('workshops')
    .update({ participantes: participants })
    .eq('id', workshopId)
  ensureOk(res, 'update workshops')
}

export async function insertCalibrationDb(record: CalibrationRecord) {
  const res = await supabase.from('calibracoes').insert({
    id: record.id,
    poco_id: parsePocoId(record.wellId),
    nome_poco: record.wellName,
    sensor: record.sensor,
    offset_valor: record.offset,
    slope_pct: record.slopePct ?? null,
    solucao_referencia: record.bufferReference,
    numero_serie: record.serialNumber,
    versao_firmware: record.firmwareVersion,
    tecnico_id: record.technicianId,
    versao: record.version,
    created_at: record.createdAt,
  })
  ensureOk(res, 'insert calibracoes')
}

export async function insertHardwareSwapDb(record: HardwareSwapRecord) {
  const res = await supabase.from('trocas_hardware').insert({
    id: record.id,
    poco_id: parsePocoId(record.wellId),
    nome_poco: record.wellName,
    tipo_componente: record.componentType,
    numero_serie: record.serialNumber,
    versao_firmware: record.firmwareVersion,
    observacoes: record.notes,
    tecnico_id: record.technicianId,
    created_at: record.createdAt,
  })
  ensureOk(res, 'insert trocas_hardware')
}

export async function insertAuditLogDb(log: AuditLogEntry) {
  const res = await supabase.from('auditoria_logs').insert({
    id: log.id,
    timestamp: log.timestamp,
    ator_id: log.actorId,
    endereco_ip: log.ipAddress,
    acao: log.action,
    email_alvo: log.targetEmail,
    detalhes: log.details,
  })
  ensureOk(res, 'insert auditoria_logs')
}

export async function insertPlatformUserDb(
  user: PlatformUser,
  log: AuditLogEntry,
): Promise<string> {
  const res = await supabase
    .from('usuarios')
    .insert({
      nome: user.name,
      email: user.email,
      perfil: user.role,
      status: user.status,
      sessoes_ativas: user.activeSessions,
    })
    .select('id')
    .single()
  const row = ensureOk(res, 'insert usuarios')
  if (!row) throw new Error('Supabase (insert usuarios): resposta vazia')
  await insertAuditLogDb(log)
  return String(row.id)
}

export async function updatePlatformUserRoleDb(
  userId: string,
  role: PlatformRole,
  log: AuditLogEntry,
) {
  const idNum = Number(userId)
  if (!Number.isInteger(idNum)) return
  const res = await supabase.from('usuarios').update({ perfil: role }).eq('id', idNum)
  ensureOk(res, 'update usuarios role')
  await insertAuditLogDb(log)
}

export async function updatePlatformUserStatusDb(
  userId: string,
  status: UserAccountStatus,
  activeSessions: number,
  log: AuditLogEntry,
) {
  const idNum = Number(userId)
  if (!Number.isInteger(idNum)) return
  const res = await supabase
    .from('usuarios')
    .update({ status, sessoes_ativas: activeSessions })
    .eq('id', idNum)
  ensureOk(res, 'update usuarios status')
  await insertAuditLogDb(log)
}
