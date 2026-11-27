import type { SensorReading, WaterStatus, Well, Workshop } from '../types/mipc.ts'

export const COMM_TIMEOUT_MINUTES = 30
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * Filters out hardware disconnect sentinels (e.g., DS18B20 -127 °C) from temperature stats/charts.
 */
export function isValidWaterTemperature(temp: number): boolean {
  return Number.isFinite(temp) && temp >= 0 && temp <= 60
}

/**
 * HU-MIPC-01 sanitary alert classification:
 * - Crítico: pH < 6.0 ou > 9.5, turbidez >= 5 UNT ou temperatura >= 25 °C
 * - Atenção: turbidez entre 4 e 5 UNT (4 <= t < 5) ou pequenas oscilações de pH (< 6.5 ou > 9.0)
 * - Excelente (Normal): demais casos dentro dos limites sanitários
 */
export function classifyWaterStatus(reading: {
  ph: number
  turbidity: number
  temperature: number
}): WaterStatus {
  const { ph, turbidity, temperature } = reading

  if (ph < 6.0 || ph > 9.5 || turbidity >= 5.0 || temperature >= 25.0) {
    return 'Crítico'
  }

  if ((turbidity >= 4.0 && turbidity < 5.0) || ph < 6.5 || ph > 9.0) {
    return 'Atenção'
  }

  return 'Excelente'
}

/**
 * HU-MIPC-01 communication watchdog: > 30 minutes without data triggers "Falha de Comunicação".
 */
export function hasCommunicationFailure(lastTransmissionMinutesAgo: number): boolean {
  return lastTransmissionMinutesAgo > COMM_TIMEOUT_MINUTES
}

export function getCriticalReasons(reading: {
  ph: number
  turbidity: number
  temperature: number
}): string[] {
  const reasons: string[] = []
  if (reading.ph < 6.0 || reading.ph > 9.5) {
    reasons.push(`pH fora da faixa segura (${reading.ph.toFixed(1)})`)
  } else if (reading.ph < 6.5 || reading.ph > 9.0) {
    reasons.push(`Oscilação de pH (${reading.ph.toFixed(1)})`)
  }

  if (reading.turbidity >= 5.0) {
    reasons.push(`Turbidez crítica (${reading.turbidity.toFixed(1)} UNT >= 5 UNT)`)
  } else if (reading.turbidity >= 4.0) {
    reasons.push(`Turbidez em atenção (${reading.turbidity.toFixed(1)} UNT)`)
  }

  if (reading.temperature >= 25.0) {
    reasons.push(`Temperatura elevada (${reading.temperature.toFixed(1)} °C >= 25 °C)`)
  }

  return reasons
}

export interface MetricStats {
  mean: number
  min: number
  max: number
  stdDev: number
}

export function computeMetricStats(values: number[]): MetricStats {
  if (values.length === 0) {
    return { mean: 0, min: 0, max: 0, stdDev: 0 }
  }
  const sum = values.reduce((acc, v) => acc + v, 0)
  const mean = sum / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return {
    mean,
    min,
    max,
    stdDev: Math.sqrt(variance),
  }
}

export function filterReadingsByDateRange(
  readings: SensorReading[],
  startDate: string,
  endDate: string,
): SensorReading[] {
  if (!startDate || !endDate) return []
  const startMs = new Date(`${startDate}T00:00:00`).getTime()
  const endMs = new Date(`${endDate}T23:59:59.999`).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) return []

  return readings
    .filter((r) => {
      const t = new Date(r.timestamp).getTime()
      return t >= startMs && t <= endMs
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function formatDateBR(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR')
}

export function formatDecimalBR(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',')
}

export function formatCoordinatesWGS84(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir} (WGS84 / SIRGAS 2000)`
}

export async function generateIntegrityHash(payload: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(payload)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }
  // Fallback deterministic hex when crypto.subtle is unavailable (e.g. non-secure context)
  let h = 2166136261
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `FALLBACK-${(h >>> 0).toString(16).padStart(8, '0').toUpperCase()}`
}

export function getWellOperationalSummary(well: Well): {
  status: WaterStatus
  commFailure: boolean
  reasons: string[]
} {
  return {
    status: classifyWaterStatus(well.currentReading),
    commFailure: hasCommunicationFailure(well.lastTransmissionMinutesAgo),
    reasons: getCriticalReasons(well.currentReading),
  }
}

export interface ResidentWaterGuidance {
  level: 'safe' | 'caution' | 'danger'
  statusLabel: string
  headline: string
  instruction: string
  tipTitle: string
  tipBody: string
}

/**
 * HU-MIPC-04: translates raw sensor status + maintenance state into plain-language guidance.
 */
export function getResidentWaterGuidance(
  well: Well,
  hasActiveMaintenance = false,
): ResidentWaterGuidance {
  if (well.interdicted) {
    return {
      level: 'danger',
      statusLabel: 'Interditado / Emergência',
      headline:
        'Poço interditado por urgência hídrica — Não consuma a água deste ponto.',
      instruction:
        well.interdictionReason ||
        'A liderança comunitária acionou a equipe de campo da Fundação Água Limpa (SLA 2h).',
      tipTitle: 'Orientação de emergência',
      tipBody:
        'Utilize exclusivamente poços vizinhos com selo verde até a liberação oficial da equipe técnica.',
    }
  }

  const status = classifyWaterStatus(well.currentReading)
  const offline = hasCommunicationFailure(well.lastTransmissionMinutesAgo)

  if (status === 'Crítico') {
    return {
      level: 'danger',
      statusLabel: 'Crítico / Não Consumir',
      headline:
        'Água Imprópria para Consumo Direto — Utilize fontes alternativas ou siga as orientações do boletim sanitário',
      instruction:
        'Não beba nem cozinhe com a água deste poço até a liberação pela equipe da Fundação Água Limpa.',
      tipTitle: 'O que fazer agora',
      tipBody:
        'Busque água em um poço vizinho com selo verde ou aguarde o comunicado de normalização na aba Comunicados.',
    }
  }

  if (status === 'Atenção' || hasActiveMaintenance || offline) {
    return {
      level: 'caution',
      statusLabel: 'Atenção / Uso Restrito',
      headline:
        'Água Imprópria para Consumo Direto — Utilize fontes alternativas ou siga as orientações do boletim sanitário',
      instruction: offline
        ? 'O sensor deste poço está temporariamente sem sinal. Ferva a água antes de beber até a verificação do agente da ONG.'
        : 'Ferva a água por 5 minutos antes de beber ou aguarde a conclusão da manutenção pelo agente da ONG.',
      tipTitle: 'Cuidado preventivo',
      tipBody:
        'Prefira água fervida ou filtrada para crianças e idosos enquanto o poço estiver em acompanhamento.',
    }
  }

  return {
    level: 'safe',
    statusLabel: 'Água Segura / Excelente',
    headline: 'Água própria para consumo da sua família.',
    instruction: 'Todos os indicadores de qualidade estão dentro dos padrões seguros.',
    tipTitle: 'Dica de armazenamento em casa',
    tipBody:
      'Mantenha sua caixa d’água sempre bem tampada, higienize o reservatório a cada 6 meses e use recipientes limpos ao coletar água.',
  }
}

export function formatOmbudsmanProtocol(year: number, sequence: number): string {
  return `OUV-${year}-${String(sequence).padStart(5, '0')}`
}

export function validateOmbudsmanInput(input: {
  wellId: string
  category: string
  description: string
}): { wellId?: boolean; category?: boolean; description?: boolean; banner?: string } {
  const errors: { wellId?: boolean; category?: boolean; description?: boolean; banner?: string } =
    {}
  if (!input.wellId) {
    errors.wellId = true
    errors.banner = 'Selecione o poço comunitário referente à sua ocorrência para continuar'
    return errors
  }
  if (!input.category) errors.category = true
  if (input.description.trim().length < 15) errors.description = true
  if (errors.category || errors.description) {
    errors.banner =
      'Escolha a categoria e descreva o problema com pelo menos 15 caracteres para enviar.'
  }
  return errors
}

export function formatUrgencyProtocol(year: number, sequence: number): string {
  return `URG-${year}-${String(sequence).padStart(5, '0')}`
}

export function validateEmergencyInput(input: {
  wellId: string
  category: string
  description: string
  photosCount: number
  hasAudio: boolean
}): { wellId?: boolean; category?: boolean; evidence?: boolean; banner?: string } {
  const errors: { wellId?: boolean; category?: boolean; evidence?: boolean; banner?: string } = {}
  if (!input.wellId) errors.wellId = true
  if (!input.category) errors.category = true

  const hasEvidence =
    input.description.trim().length >= 10 || input.photosCount > 0 || input.hasAudio

  if (!hasEvidence) {
    errors.evidence = true
    errors.banner =
      'Forneça ao menos uma descrição detalhada, foto ou relato de áudio para confirmar a emergência'
    return errors
  }

  if (errors.wellId || errors.category) {
    errors.banner = 'Selecione o poço afetado e a categoria da urgência hídrica para enviar.'
  }
  return errors
}

export interface SectorConsolidation {
  phMean: number
  turbidityMean: number
  temperatureMean: number
  sensorAvailabilityPct: number
  totalReadings: number
  recurrentCriticalWells: { well: Well; criticalCount: number }[]
}

/**
 * HU-MIPC-07: consolidates biweekly/monthly sanitary means, sensor availability,
 * and flags wells with > 3 critical alerts in the period.
 */
export function computeSectorConsolidation(
  wells: Well[],
  days: number,
  todayIso = new Date().toISOString().slice(0, 10),
): SectorConsolidation {
  const startDate = addDaysToIsoDate(todayIso, -days)
  const allReadings: SensorReading[] = []
  const recurrentCriticalWells: { well: Well; criticalCount: number }[] = []

  let onlineCount = 0
  for (const well of wells) {
    if (!hasCommunicationFailure(well.lastTransmissionMinutesAgo)) onlineCount++
    const readings = filterReadingsByDateRange(well.history, startDate, todayIso)
    allReadings.push(...readings)
    const criticalCount = readings.filter((r) => classifyWaterStatus(r) === 'Crítico').length
    if (criticalCount > 3) {
      recurrentCriticalWells.push({ well, criticalCount })
    }
  }

  return {
    phMean: computeMetricStats(allReadings.map((r) => r.ph)).mean,
    turbidityMean: computeMetricStats(allReadings.map((r) => r.turbidity)).mean,
    temperatureMean: computeMetricStats(allReadings.map((r) => r.temperature)).mean,
    sensorAvailabilityPct: wells.length > 0 ? Math.round((onlineCount / wells.length) * 100) : 0,
    totalReadings: allReadings.length,
    recurrentCriticalWells,
  }
}

/**
 * HU-MIPC-09: pure RSVP transition with waitlist and automatic promotion on cancellation.
 */
export function applyWorkshopRsvp(
  workshop: Workshop,
  residentName: string,
  action: 'join' | 'cancel',
  nowIso = new Date().toISOString(),
): { workshop: Workshop; outcome: 'confirmed' | 'waitlist' | 'cancelled' | 'unchanged' } {
  const existing = workshop.participants.find((p) => p.name === residentName)

  if (action === 'join') {
    if (existing) return { workshop, outcome: 'unchanged' }
    const confirmedCount = workshop.participants.filter((p) => p.status === 'confirmed').length
    const status = confirmedCount < workshop.maxSeats ? 'confirmed' : 'waitlist'
    return {
      workshop: {
        ...workshop,
        participants: [
          ...workshop.participants,
          { name: residentName, status, checkedIn: false, joinedAt: nowIso },
        ],
      },
      outcome: status,
    }
  }

  if (!existing) return { workshop, outcome: 'unchanged' }
  const remaining = workshop.participants.filter((p) => p.name !== residentName)
  if (existing.status === 'confirmed') {
    const nextWaitIdx = remaining.findIndex((p) => p.status === 'waitlist')
    if (nextWaitIdx !== -1) {
      remaining[nextWaitIdx] = { ...remaining[nextWaitIdx], status: 'confirmed' }
    }
  }
  return {
    workshop: { ...workshop, participants: remaining },
    outcome: 'cancelled',
  }
}

export const IOT_HEARTBEAT_TIMEOUT_MINUTES = 15

export function classifyBattery(batteryPct: number): 'Normal' | 'Baixa' | 'Crítica' {
  if (batteryPct < 15) return 'Crítica'
  if (batteryPct <= 30) return 'Baixa'
  return 'Normal'
}

export function classifyRssi(rssiDbm: number): 'Forte' | 'Moderado' | 'Fraco' {
  if (rssiDbm > -85) return 'Forte'
  if (rssiDbm >= -100) return 'Moderado'
  return 'Fraco'
}

export function classifyConnectivity(device: {
  lastHeartbeatMinutesAgo: number
  rssiDbm: number
  packetLossPct: number
}): 'Online' | 'Instável' | 'Offline' {
  if (device.lastHeartbeatMinutesAgo > IOT_HEARTBEAT_TIMEOUT_MINUTES) return 'Offline'
  if (device.rssiDbm < -100 || device.packetLossPct > 10) return 'Instável'
  return 'Online'
}

/**
 * HU-MIPC-12: manufacturer physical bounds validation for pH & turbidity sensor calibration.
 */
export function validateCalibrationInput(input: {
  sensor: 'pH' | 'Turbidez'
  offset: number
  slopePct?: number
}): { offset?: boolean; slope?: boolean; banner?: string } {
  const outOfRangeMsg =
    'Valor de offset fora dos limites tolerados pelo fabricante. Verifique a medição'

  if (Number.isNaN(input.offset)) {
    return { offset: true, banner: outOfRangeMsg }
  }

  if (input.sensor === 'pH') {
    const badOffset = input.offset < -2.0 || input.offset > 2.0
    const badSlope =
      input.slopePct === undefined ||
      Number.isNaN(input.slopePct) ||
      input.slopePct < 80 ||
      input.slopePct > 105
    if (badOffset || badSlope) {
      return { offset: badOffset, slope: badSlope, banner: outOfRangeMsg }
    }
    return {}
  }

  // Turbidez (NTU/UNT): manufacturer zero-offset tolerance ±1.5 UNT
  if (input.offset < -1.5 || input.offset > 1.5) {
    return { offset: true, banner: outOfRangeMsg }
  }
  return {}
}

export interface BulletinIndicators {
  total: number
  excellentCount: number
  attentionCount: number
  criticalCount: number
  compliancePct: number
  anomalyPct: number
  iqaScore: number
  iqaLabel: 'Ótima' | 'Boa' | 'Regular' | 'Crítica'
  avgReservoirPct: number
  turbidityTrend: 'Em alta' | 'Em queda' | 'Estável'
  maxConsecutiveCritical: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function readingIqaScore(r: { ph: number; turbidity: number; temperature: number }): number {
  // pH sub-score (0..100): ideal 6.5..8.5, safe 6.0..9.5
  let phScore = 100
  if (r.ph < 6.5) {
    phScore = r.ph >= 6.0 ? 55 + ((r.ph - 6.0) / 0.5) * 45 : clamp(55 - (6.0 - r.ph) * 30, 10, 55)
  } else if (r.ph > 8.5) {
    phScore = r.ph <= 9.5 ? 55 + ((9.5 - r.ph) / 1.0) * 45 : clamp(55 - (r.ph - 9.5) * 30, 10, 55)
  }

  // Turbidity sub-score (0..100): ideal <= 1 UNT, attention 4..5, critical >= 5
  let turbScore = 100
  if (r.turbidity > 1.0) {
    if (r.turbidity <= 4.0) {
      turbScore = 100 - ((r.turbidity - 1.0) / 3.0) * 30
    } else if (r.turbidity <= 5.0) {
      turbScore = 70 - ((r.turbidity - 4.0) / 1.0) * 30
    } else {
      turbScore = clamp(40 - ((r.turbidity - 5.0) / 5.0) * 35, 5, 40)
    }
  }

  // Temperature sub-score (0..100): ideal <= 22 C, critical >= 25 C
  let tempScore = 100
  if (r.temperature > 22.0) {
    tempScore =
      r.temperature <= 25.0
        ? 100 - ((r.temperature - 22.0) / 3.0) * 45
        : clamp(55 - ((r.temperature - 25.0) / 7.0) * 45, 10, 55)
  }

  return phScore * 0.4 + turbScore * 0.4 + tempScore * 0.2
}

export function computeBulletinIndicators(readings: SensorReading[]): BulletinIndicators {
  const total = readings.length
  if (total === 0) {
    return {
      total: 0,
      excellentCount: 0,
      attentionCount: 0,
      criticalCount: 0,
      compliancePct: 0,
      anomalyPct: 0,
      iqaScore: 0,
      iqaLabel: 'Crítica',
      avgReservoirPct: 0,
      turbidityTrend: 'Estável',
      maxConsecutiveCritical: 0,
    }
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  let excellentCount = 0
  let attentionCount = 0
  let criticalCount = 0
  let iqaSum = 0
  let reservoirSum = 0
  let streak = 0
  let maxConsecutiveCritical = 0

  for (const r of sorted) {
    const status = classifyWaterStatus(r)
    if (status === 'Excelente') {
      excellentCount += 1
      streak = 0
    } else if (status === 'Atenção') {
      attentionCount += 1
      streak = 0
    } else {
      criticalCount += 1
      streak += 1
      if (streak > maxConsecutiveCritical) maxConsecutiveCritical = streak
    }
    iqaSum += readingIqaScore(r)
    reservoirSum += r.reservoirLevel
  }

  const iqaScore = Math.round(iqaSum / total)
  const iqaLabel: BulletinIndicators['iqaLabel'] =
    iqaScore >= 85 ? 'Ótima' : iqaScore >= 70 ? 'Boa' : iqaScore >= 50 ? 'Regular' : 'Crítica'

  let turbidityTrend: BulletinIndicators['turbidityTrend'] = 'Estável'
  if (sorted.length >= 2) {
    const windowSize = Math.max(1, Math.floor(sorted.length / 3))
    const firstAvg =
      sorted.slice(0, windowSize).reduce((s, r) => s + r.turbidity, 0) / windowSize
    const lastAvg =
      sorted.slice(-windowSize).reduce((s, r) => s + r.turbidity, 0) / windowSize
    const delta = lastAvg - firstAvg
    if (delta >= 0.3) turbidityTrend = 'Em alta'
    else if (delta <= -0.3) turbidityTrend = 'Em queda'
  }

  const compliancePct = Number(((excellentCount / total) * 100).toFixed(1))
  const anomalyPct = Number((((attentionCount + criticalCount) / total) * 100).toFixed(1))

  return {
    total,
    excellentCount,
    attentionCount,
    criticalCount,
    compliancePct,
    anomalyPct,
    iqaScore,
    iqaLabel,
    avgReservoirPct: Math.round(reservoirSum / total),
    turbidityTrend,
    maxConsecutiveCritical,
  }
}
