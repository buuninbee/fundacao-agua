import { jsPDF } from 'jspdf'
import type {
  MaintenanceRecord,
  SensorReading,
  WaterStatus,
  Well,
} from '../types/mipc.ts'
import {
  classifyWaterStatus,
  computeBulletinIndicators,
  computeMetricStats,
  formatCoordinatesWGS84,
  formatDateBR,
  formatDecimalBR,
  isValidWaterTemperature,
} from './waterRules.ts'

export interface GenerateBulletinPdfInput {
  protocolCode: string
  well: Well
  periodStart: string
  periodEnd: string
  readings: SensorReading[]
  maintenances: MaintenanceRecord[]
  issuerId: string
  issuerName: string
  integrityHash: string
  generatedAt: string
}

type Rgb = [number, number, number]

const COLOR_BLUE_900: Rgb = [0, 19, 37]
const COLOR_BLUE_500: Rgb = [0, 45, 88]
const COLOR_BLUE_300: Rgb = [84, 114, 143]
const COLOR_ORANGE_500: Rgb = [254, 168, 66]
const COLOR_ORANGE_700: Rgb = [180, 119, 47]
const COLOR_BG_SOFT: Rgb = [245, 249, 253]
const COLOR_BORDER: Rgb = [213, 219, 228]
const COLOR_MUTED: Rgb = [98, 101, 105]
const COLOR_GREEN: Rgb = [5, 150, 105]
const COLOR_AMBER: Rgb = [217, 119, 6]
const COLOR_RED: Rgb = [220, 38, 38]

function statusRgb(status: WaterStatus): Rgb {
  if (status === 'Crítico') return COLOR_RED
  if (status === 'Atenção') return COLOR_AMBER
  return COLOR_GREEN
}

function shortAxisLabel(iso: string, sameDay: boolean): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 5)
  if (sameDay) {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function isSameCalendarDay(points: SensorReading[]): boolean {
  if (points.length < 2) return false
  const first = new Date(points[0].timestamp)
  const last = new Date(points[points.length - 1].timestamp)
  return (
    first.getFullYear() === last.getFullYear() &&
    first.getMonth() === last.getMonth() &&
    first.getDate() === last.getDate()
  )
}

function drawFooter(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  integrityHash: string,
  pageNumber: number,
  totalPages: number,
) {
  const footerY = 274
  doc.setDrawColor(...COLOR_BORDER)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR_BLUE_500)
  doc.text('VERIFICAÇÃO DE AUTENTICIDADE E INTEGRIDADE (SHA-256)', margin, footerY)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_MUTED)
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, footerY, {
    align: 'right',
  })

  doc.setFont('courier', 'normal')
  doc.setFontSize(7)
  doc.text(integrityHash, margin, footerY + 4.2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'Documento gerado eletronicamente pela Plataforma MIPC — Fundação Água Limpa (Assentamento Santa Luzia - DF).',
    margin,
    footerY + 8.8,
  )
}

function drawContinuationHeader(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  protocolCode: string,
  wellName: string,
) {
  doc.setFillColor(...COLOR_BLUE_900)
  doc.rect(0, 0, pageWidth, 16, 'F')
  doc.setFillColor(...COLOR_ORANGE_500)
  doc.rect(0, 16, pageWidth, 1.4, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bold')
  doc.setFontSize(10.5)
  doc.text('FUNDAÇÃO ÁGUA LIMPA — BOLETIM TÉCNICO MIPC', margin, 10.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`${protocolCode} · ${wellName}`, pageWidth - margin, 10.5, { align: 'right' })
}

/**
 * Vector Dual-Axis Line Chart: Turbidity (UNT, left axis) + pH (right axis) over time.
 */
function drawTurbidityPhChart(
  doc: jsPDF,
  readings: SensorReading[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Card container
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...COLOR_BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')

  // Header + legend
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text('Evolução Temporal — Turbidez (UNT) e pH', x + 4, y + 6)

  // Legend badges (right-aligned)
  const legY = y + 5.3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setFillColor(...COLOR_RED)
  doc.rect(x + w - 82, legY - 2, 4, 1.4, 'F')
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text('Turbidez (UNT)', x + w - 76.5, legY)

  doc.setFillColor(...COLOR_BLUE_500)
  doc.rect(x + w - 52, legY - 2, 4, 1.4, 'F')
  doc.text('pH', x + w - 46.5, legY)

  doc.setDrawColor(...COLOR_RED)
  doc.setLineDashPattern([1.2, 1.2], 0)
  doc.setLineWidth(0.35)
  doc.line(x + w - 36, legY - 1.3, x + w - 31, legY - 1.3)
  doc.setLineDashPattern([], 0)
  doc.text('Limite 5,0 UNT', x + w - 29.5, legY)

  // Plot area bounds
  const px = x + 13
  const py = y + 11
  const pw = w - 26
  const ph = h - 20

  const turbMaxData = Math.max(...readings.map((r) => r.turbidity), 5.5)
  const turbMax = Math.ceil(turbMaxData * 1.15)
  const phMin = 4.5
  const phMax = 10.0

  // Subtle safe-pH band (6.0 to 9.5 on right scale)
  const safeTopY = py + ph * (1 - (9.5 - phMin) / (phMax - phMin))
  const safeBotY = py + ph * (1 - (6.0 - phMin) / (phMax - phMin))
  doc.setFillColor(240, 249, 255)
  doc.rect(px, safeTopY, pw, safeBotY - safeTopY, 'F')

  // Horizontal grid + Y-axis ticks (4 steps)
  const ticks = 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  for (let i = 0; i <= ticks; i++) {
    const frac = i / ticks
    const gy = py + ph * (1 - frac)

    doc.setDrawColor(232, 237, 244)
    doc.setLineWidth(0.2)
    doc.line(px, gy, px + pw, gy)

    // Left axis: Turbidity
    const turbVal = frac * turbMax
    doc.setTextColor(...COLOR_RED)
    doc.text(formatDecimalBR(turbVal, 1), px - 2, gy + 1.1, { align: 'right' })

    // Right axis: pH
    const phVal = phMin + frac * (phMax - phMin)
    doc.setTextColor(...COLOR_BLUE_500)
    doc.text(formatDecimalBR(phVal, 1), px + pw + 2, gy + 1.1)
  }

  // Axis unit labels
  doc.setFontSize(6)
  doc.setTextColor(...COLOR_RED)
  doc.text('UNT', px - 2, py - 2, { align: 'right' })
  doc.setTextColor(...COLOR_BLUE_500)
  doc.text('pH', px + pw + 2, py - 2)

  // Critical turbidity threshold dashed line (5.0 UNT)
  const limitY = py + ph * (1 - Math.min(5.0, turbMax) / turbMax)
  doc.setDrawColor(...COLOR_RED)
  doc.setLineDashPattern([1.6, 1.4], 0)
  doc.setLineWidth(0.35)
  doc.line(px, limitY, px + pw, limitY)
  doc.setLineDashPattern([], 0)

  // Border axes
  doc.setDrawColor(...COLOR_BORDER)
  doc.setLineWidth(0.3)
  doc.line(px, py, px, py + ph)
  doc.line(px + pw, py, px + pw, py + ph)
  doc.line(px, py + ph, px + pw, py + ph)

  // Downsample points slightly only if extremely large (> 40) to stay legible
  const points =
    readings.length > 40
      ? readings.filter((_, idx) => idx % Math.ceil(readings.length / 40) === 0 || idx === readings.length - 1)
      : readings

  const xForIndex = (idx: number) =>
    points.length === 1 ? px + pw / 2 : px + (idx / (points.length - 1)) * pw
  const yForTurb = (val: number) =>
    py + ph * (1 - Math.max(0, Math.min(val, turbMax)) / turbMax)
  const yForPh = (val: number) =>
    py + ph * (1 - Math.max(0, Math.min(val - phMin, phMax - phMin)) / (phMax - phMin))

  // Draw Turbidity series
  doc.setDrawColor(...COLOR_RED)
  doc.setLineWidth(0.55)
  for (let i = 1; i < points.length; i++) {
    doc.line(
      xForIndex(i - 1),
      yForTurb(points[i - 1].turbidity),
      xForIndex(i),
      yForTurb(points[i].turbidity),
    )
  }
  doc.setFillColor(...COLOR_RED)
  points.forEach((pt, i) => {
    doc.circle(xForIndex(i), yForTurb(pt.turbidity), 0.9, 'F')
  })

  // Draw pH series
  doc.setDrawColor(...COLOR_BLUE_500)
  doc.setLineWidth(0.55)
  for (let i = 1; i < points.length; i++) {
    doc.line(xForIndex(i - 1), yForPh(points[i - 1].ph), xForIndex(i), yForPh(points[i].ph))
  }
  doc.setFillColor(...COLOR_BLUE_500)
  points.forEach((pt, i) => {
    doc.circle(xForIndex(i), yForPh(pt.ph), 0.9, 'F')
  })

  // X-axis labels (at most 7 evenly spaced labels)
  const sameDay = isSameCalendarDay(points)
  const maxLabels = Math.min(7, points.length)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.3)
  doc.setTextColor(...COLOR_MUTED)
  if (maxLabels === 1) {
    doc.text(shortAxisLabel(points[0].timestamp, false), xForIndex(0), py + ph + 4.5, { align: 'center' })
  } else {
    for (let k = 0; k < maxLabels; k++) {
      const idx = Math.round((k / (maxLabels - 1)) * (points.length - 1))
      doc.text(shortAxisLabel(points[idx].timestamp, sameDay), xForIndex(idx), py + ph + 4.5, {
        align: 'center',
      })
    }
  }
}

/**
 * Vector Status Distribution Panel: stacked bar + horizontal proportion bars.
 */
function drawStatusDistributionChart(
  doc: jsPDF,
  counts: { excellent: number; attention: number; critical: number; total: number },
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...COLOR_BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.2)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text('Distribuição Sanitária das Leituras', x + 4, y + 6)

  const total = Math.max(1, counts.total)
  const barX = x + 4
  const barW = w - 8
  const stackedY = y + 10
  const stackedH = 5.5

  // Stacked proportional bar
  doc.setFillColor(236, 240, 246)
  doc.roundedRect(barX, stackedY, barW, stackedH, 1.2, 1.2, 'F')

  const segments: { count: number; color: Rgb; label: string }[] = [
    { count: counts.excellent, color: COLOR_GREEN, label: 'Excelente' },
    { count: counts.attention, color: COLOR_AMBER, label: 'Atenção' },
    { count: counts.critical, color: COLOR_RED, label: 'Crítico' },
  ]

  let cursorX = barX
  for (const seg of segments) {
    if (seg.count <= 0) continue
    const segW = (seg.count / total) * barW
    doc.setFillColor(...seg.color)
    doc.rect(cursorX, stackedY, segW, stackedH, 'F')
    cursorX += segW
  }

  // Horizontal breakdown rows
  let rowY = stackedY + 11.5
  for (const seg of segments) {
    const pct = (seg.count / total) * 100
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(...seg.color)
    doc.text(seg.label, barX, rowY)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_BLUE_900)
    doc.text(`${seg.count} (${formatDecimalBR(pct, 1)}%)`, barX + barW, rowY, { align: 'right' })

    // Track + fill bar
    doc.setFillColor(238, 242, 248)
    doc.roundedRect(barX, rowY + 1.5, barW, 2.6, 0.8, 0.8, 'F')
    if (seg.count > 0) {
      doc.setFillColor(...seg.color)
      doc.roundedRect(barX, rowY + 1.5, Math.max(1.8, (seg.count / total) * barW), 2.6, 0.8, 0.8, 'F')
    }

    rowY += 8.2
  }
}

/**
 * Vector Temperature Line Chart with 25 C critical threshold.
 * Discards hardware disconnect sentinels (e.g., DS18B20 -127 °C) so the Y-axis stays readable.
 */
function drawTemperatureChart(
  doc: jsPDF,
  readings: SensorReading[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...COLOR_BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')

  const validReadings = readings.filter((r) => isValidWaterTemperature(r.temperature))
  const discardedCount = readings.length - validReadings.length

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.2)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text('Temperatura da Água (°C)', x + 4, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.3)
  doc.setTextColor(...COLOR_RED)
  const rightLabel =
    discardedCount > 0
      ? `Limite: 25,0 °C · ${discardedCount} falha(s) ignorada(s)`
      : 'Limite: 25,0 °C'
  doc.text(rightLabel, x + w - 4, y + 6, { align: 'right' })

  if (validReadings.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLOR_MUTED)
    doc.text('Sem leituras válidas de temperatura no período.', x + w / 2, y + h / 2 + 2, {
      align: 'center',
    })
    return
  }

  const px = x + 11
  const py = y + 10.5
  const pw = w - 15
  const ph = h - 18.5

  const temps = validReadings.map((r) => r.temperature)
  const rawMin = Math.min(...temps)
  const rawMax = Math.max(...temps)
  const minT = Math.max(0, Math.floor(Math.min(rawMin, 22) - 2))
  const maxT = Math.ceil(Math.max(rawMax, 26) + 2)

  // Horizontal grid (4 ticks)
  doc.setFontSize(6.2)
  for (let i = 0; i <= 4; i++) {
    const frac = i / 4
    const gy = py + ph * (1 - frac)
    doc.setDrawColor(232, 237, 244)
    doc.setLineWidth(0.2)
    doc.line(px, gy, px + pw, gy)

    const val = minT + frac * (maxT - minT)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(`${formatDecimalBR(val, 0)}°`, px - 1.8, gy + 1.1, { align: 'right' })
  }

  // 25 C dashed limit line
  if (25 >= minT && 25 <= maxT) {
    const limitY = py + ph * (1 - (25 - minT) / (maxT - minT))
    doc.setDrawColor(...COLOR_RED)
    doc.setLineDashPattern([1.4, 1.2], 0)
    doc.setLineWidth(0.35)
    doc.line(px, limitY, px + pw, limitY)
    doc.setLineDashPattern([], 0)
  }

  // Axes
  doc.setDrawColor(...COLOR_BORDER)
  doc.setLineWidth(0.3)
  doc.line(px, py, px, py + ph)
  doc.line(px, py + ph, px + pw, py + ph)

  // Line series (downsample only if > 40 valid readings)
  const points =
    validReadings.length > 40
      ? validReadings.filter(
          (_, idx) =>
            idx % Math.ceil(validReadings.length / 40) === 0 || idx === validReadings.length - 1,
        )
      : validReadings

  const xForIndex = (idx: number) =>
    points.length === 1 ? px + pw / 2 : px + (idx / (points.length - 1)) * pw
  const yForTemp = (val: number) =>
    py + ph * (1 - Math.max(0, Math.min(val - minT, maxT - minT)) / Math.max(1, maxT - minT))

  doc.setDrawColor(...COLOR_ORANGE_700)
  doc.setLineWidth(0.55)
  for (let i = 1; i < points.length; i++) {
    doc.line(
      xForIndex(i - 1),
      yForTemp(points[i - 1].temperature),
      xForIndex(i),
      yForTemp(points[i].temperature),
    )
  }

  points.forEach((pt, idx) => {
    const dotColor: Rgb = pt.temperature >= 25 ? COLOR_RED : COLOR_ORANGE_700
    doc.setFillColor(...dotColor)
    doc.circle(xForIndex(idx), yForTemp(pt.temperature), 0.9, 'F')
  })

  // X-axis labels (up to 4 evenly spaced dates or HH:mm if same day)
  const sameDay = isSameCalendarDay(points)
  const maxLabels = Math.min(4, points.length)
  doc.setFontSize(6.2)
  doc.setTextColor(...COLOR_MUTED)
  if (maxLabels === 1) {
    doc.text(shortAxisLabel(points[0].timestamp, false), xForIndex(0), py + ph + 4.2, {
      align: 'center',
    })
  } else {
    for (let k = 0; k < maxLabels; k++) {
      const idx = Math.round((k / (maxLabels - 1)) * (points.length - 1))
      const align = k === 0 ? 'left' : k === maxLabels - 1 ? 'right' : 'center'
      doc.text(shortAxisLabel(points[idx].timestamp, sameDay), xForIndex(idx), py + ph + 4.2, {
        align,
      })
    }
  }
}

export function buildTechnicalBulletinPdf(input: GenerateBulletinPdfInput): jsPDF {
  const {
    protocolCode,
    well,
    periodStart,
    periodEnd,
    readings,
    maintenances,
    issuerId,
    issuerName,
    integrityHash,
    generatedAt,
  } = input

  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
  const indicators = computeBulletinIndicators(sortedReadings)
  const phStats = computeMetricStats(sortedReadings.map((r) => r.ph))
  const turbStats = computeMetricStats(sortedReadings.map((r) => r.turbidity))
  const validTemps = sortedReadings
    .map((r) => r.temperature)
    .filter((t) => isValidWaterTemperature(t))
  const tempStats = computeMetricStats(
    validTemps.length > 0 ? validTemps : sortedReadings.map((r) => r.temperature),
  )
  const resStats = computeMetricStats(sortedReadings.map((r) => r.reservoirLevel))

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentW = pageWidth - margin * 2
  const maxBodyY = 264
  let y = 0

  const ensureSpace = (needed: number) => {
    if (y + needed > maxBodyY) {
      doc.addPage()
      drawContinuationHeader(doc, margin, pageWidth, protocolCode, well.name)
      y = 24
    }
  }

  // --- Official ONG letterhead ---
  doc.setFillColor(...COLOR_BLUE_900)
  doc.rect(0, 0, pageWidth, 32, 'F')
  doc.setFillColor(...COLOR_ORANGE_500)
  doc.rect(0, 32, pageWidth, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bold')
  doc.setFontSize(16.5)
  doc.text('FUNDAÇÃO ÁGUA LIMPA — MIPC', margin, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('BOLETIM TÉCNICO GEORREFERENCIADO DE QUALIDADE DA ÁGUA', margin, 20)
  doc.setFontSize(8)
  doc.text(
    `Protocolo: ${protocolCode}   |   Emissão: ${new Date(generatedAt).toLocaleString('pt-BR')}   |   Emissor: ${issuerName} (${issuerId})`,
    margin,
    26.5,
  )

  y = 40

  // --- Section 1: Unit Identification ---
  doc.setTextColor(...COLOR_BLUE_900)
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.text('1. Identificação da Unidade e Georreferenciamento', margin, y)
  y += 4.5

  doc.setFillColor(...COLOR_BG_SOFT)
  doc.setDrawColor(...COLOR_BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, contentW, 24, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.8)
  doc.text(`Unidade / Poço: ${well.name} (${well.code})`, margin + 4, y + 6)
  doc.text(
    `Comunidade / Setor: ${well.community} — ${well.sector} (~${well.affectedFamilies} famílias atendidas)`,
    margin + 4,
    y + 11.5,
  )
  doc.text(
    `Coordenadas GPS: ${formatCoordinatesWGS84(well.latitude, well.longitude)}`,
    margin + 4,
    y + 17,
  )
  doc.text(
    `Período Analisado: ${formatDateBR(periodStart)} a ${formatDateBR(periodEnd)}   |   Leituras no boletim: ${sortedReadings.length}`,
    margin + 4,
    y + 22,
  )

  y += 30

  // --- Section 2: Executive Indicators (KPI Cards) ---
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text('2. Indicadores Executivos de Qualidade e Operação', margin, y)
  y += 4.5

  const gap = 3.5
  const cardW = (contentW - gap * 3) / 4
  const cardH = 24

  const complianceColor: Rgb =
    indicators.compliancePct >= 80
      ? COLOR_GREEN
      : indicators.compliancePct >= 50
        ? COLOR_AMBER
        : COLOR_RED
  const iqaColor: Rgb =
    indicators.iqaScore >= 85
      ? COLOR_GREEN
      : indicators.iqaScore >= 70
        ? COLOR_BLUE_500
        : indicators.iqaScore >= 50
          ? COLOR_AMBER
          : COLOR_RED
  const anomalyColor: Rgb =
    indicators.criticalCount > 0
      ? COLOR_RED
      : indicators.attentionCount > 0
        ? COLOR_AMBER
        : COLOR_GREEN

  const kpiCards: {
    label: string
    value: string
    sub: string
    accent: Rgb
    progress?: number
  }[] = [
    {
      label: 'CONFORMIDADE',
      value: `${formatDecimalBR(indicators.compliancePct, 1)}%`,
      sub: `${indicators.excellentCount}/${indicators.total} Excelente`,
      accent: complianceColor,
      progress: indicators.compliancePct / 100,
    },
    {
      label: 'IQA SIMPLIFICADO',
      value: `${indicators.iqaScore}/100`,
      sub: `Qualidade ${indicators.iqaLabel}`,
      accent: iqaColor,
      progress: indicators.iqaScore / 100,
    },
    {
      label: 'ANOMALIAS',
      value: `${indicators.criticalCount + indicators.attentionCount}`,
      sub: `${indicators.criticalCount} crít. · seq. máx ${indicators.maxConsecutiveCritical}`,
      accent: anomalyColor,
    },
    {
      label: 'RESERVATÓRIO / TEND.',
      value: `${indicators.avgReservoirPct}%`,
      sub: `Turbidez: ${indicators.turbidityTrend}`,
      accent: COLOR_BLUE_500,
      progress: indicators.avgReservoirPct / 100,
    },
  ]

  kpiCards.forEach((card, idx) => {
    const cx = margin + idx * (cardW + gap)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...COLOR_BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD')

    // Top accent strip
    doc.setFillColor(...card.accent)
    doc.rect(cx + 0.5, y + 0.4, cardW - 1, 1.5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLOR_BLUE_300)
    doc.text(card.label, cx + 3, y + 6.2)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...card.accent)
    doc.text(card.value, cx + 3, y + 13.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(card.sub, cx + 3, y + 18.2)

    if (card.progress !== undefined) {
      const barY = y + 20.4
      doc.setFillColor(236, 240, 246)
      doc.roundedRect(cx + 3, barY, cardW - 6, 1.8, 0.6, 0.6, 'F')
      doc.setFillColor(...card.accent)
      doc.roundedRect(
        cx + 3,
        barY,
        Math.max(1.5, Math.min(1, card.progress) * (cardW - 6)),
        1.8,
        0.6,
        0.6,
        'F',
      )
    }
  })

  y += cardH + 7

  // --- Section 3: Analytical Charts ---
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text('3. Gráficos Analíticos das Medições IoT', margin, y)
  y += 4.5

  if (sortedReadings.length > 0) {
    drawTurbidityPhChart(doc, sortedReadings, margin, y, contentW, 56)
    y += 60

    const halfW = (contentW - 4) / 2
    drawStatusDistributionChart(
      doc,
      {
        excellent: indicators.excellentCount,
        attention: indicators.attentionCount,
        critical: indicators.criticalCount,
        total: indicators.total,
      },
      margin,
      y,
      halfW,
      46,
    )
    drawTemperatureChart(doc, sortedReadings, margin + halfW + 4, y, halfW, 46)
    y += 52
  }

  // --- Section 4: Statistical Summary Table ---
  ensureSpace(46)
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text('4. Resumo Estatístico das Medições', margin, y)
  y += 5

  const headers = ['Parâmetro', 'Média', 'Mínimo', 'Pico (Máx.)', 'Desvio', 'Limite Seguro', 'Situação']
  const colWidths = [34, 21, 21, 24, 22, 32, 26]

  doc.setFillColor(...COLOR_BLUE_500)
  doc.rect(margin, y, contentW, 7.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  let x = margin + 2
  headers.forEach((h, i) => {
    doc.text(h, x, y + 5.2)
    x += colWidths[i]
  })
  y += 7.5

  const phStatus: WaterStatus =
    phStats.min < 6.0 || phStats.max > 9.5
      ? 'Crítico'
      : phStats.min < 6.5 || phStats.max > 9.0
        ? 'Atenção'
        : 'Excelente'
  const turbStatus: WaterStatus =
    turbStats.max >= 5.0 ? 'Crítico' : turbStats.max >= 4.0 ? 'Atenção' : 'Excelente'
  const tempStatus: WaterStatus = tempStats.max >= 25.0 ? 'Crítico' : 'Excelente'
  const resStatus: WaterStatus =
    resStats.min < 30 ? 'Crítico' : resStats.min < 50 ? 'Atenção' : 'Excelente'

  const statRows: { cells: string[]; status: WaterStatus }[] = [
    {
      cells: [
        'pH',
        formatDecimalBR(phStats.mean, 2),
        formatDecimalBR(phStats.min, 2),
        formatDecimalBR(phStats.max, 2),
        formatDecimalBR(phStats.stdDev, 2),
        '6,0 a 9,5',
        phStatus,
      ],
      status: phStatus,
    },
    {
      cells: [
        'Turbidez (UNT)',
        formatDecimalBR(turbStats.mean, 2),
        formatDecimalBR(turbStats.min, 2),
        formatDecimalBR(turbStats.max, 2),
        formatDecimalBR(turbStats.stdDev, 2),
        '< 5,0 UNT',
        turbStatus,
      ],
      status: turbStatus,
    },
    {
      cells: [
        'Temperatura (°C)',
        formatDecimalBR(tempStats.mean, 1),
        formatDecimalBR(tempStats.min, 1),
        formatDecimalBR(tempStats.max, 1),
        formatDecimalBR(tempStats.stdDev, 2),
        '< 25,0 °C',
        tempStatus,
      ],
      status: tempStatus,
    },
    {
      cells: [
        'Reservatório (%)',
        `${formatDecimalBR(resStats.mean, 0)}%`,
        `${formatDecimalBR(resStats.min, 0)}%`,
        `${formatDecimalBR(resStats.max, 0)}%`,
        formatDecimalBR(resStats.stdDev, 1),
        '>= 50%',
        resStatus,
      ],
      status: resStatus,
    },
  ]

  statRows.forEach((row, rIdx) => {
    if (rIdx % 2 === 1) {
      doc.setFillColor(...COLOR_BG_SOFT)
      doc.rect(margin, y, contentW, 7.2, 'F')
    }
    doc.setDrawColor(...COLOR_BORDER)
    doc.setLineWidth(0.25)
    doc.line(margin, y + 7.2, pageWidth - margin, y + 7.2)

    let cx = margin + 2
    row.cells.forEach((cell, i) => {
      if (i === 6) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...statusRgb(row.status))
      } else if (i === 0) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...COLOR_BLUE_900)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLOR_BLUE_900)
      }
      doc.setFontSize(8)
      doc.text(cell, cx, y + 4.9)
      cx += colWidths[i]
    })
    y += 7.2
  })

  y += 9

  // --- Section 5: Alerts / Anomalies in period ---
  const anomalies = sortedReadings.filter((r) => classifyWaterStatus(r) !== 'Excelente')
  ensureSpace(22)
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text(`5. Alertas e Anomalias Detectadas no Escopo (${anomalies.length})`, margin, y)
  y += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  if (anomalies.length === 0) {
    doc.setTextColor(...COLOR_GREEN)
    doc.text('Nenhuma anomalia sanitária registrada nas medições avaliadas.', margin, y)
    y += 6.5
  } else {
    anomalies.slice(0, 12).forEach((a) => {
      ensureSpace(6)
      const status = classifyWaterStatus(a)
      const dateStr = new Date(a.timestamp).toLocaleString('pt-BR')
      doc.setTextColor(...statusRgb(status))
      doc.setFont('helvetica', 'bold')
      doc.text(`• [${status.toUpperCase()}]`, margin + 1, y)
      doc.setTextColor(...COLOR_BLUE_900)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${dateStr} — pH: ${formatDecimalBR(a.ph, 2)} | Turbidez: ${formatDecimalBR(a.turbidity, 2)} UNT | Temp.: ${formatDecimalBR(a.temperature, 1)} °C`,
        margin + 24,
        y,
      )
      y += 5.2
    })
    if (anomalies.length > 12) {
      ensureSpace(6)
      doc.setTextColor(...COLOR_MUTED)
      doc.text(
        `... e mais ${anomalies.length - 12} ocorrência(s) no histórico consolidado.`,
        margin + 2,
        y,
      )
      y += 5.2
    }
  }

  y += 5

  // --- Section 6: Maintenances in period ---
  ensureSpace(20)
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_BLUE_900)
  doc.text(`6. Intervenções e Manutenções Registradas (${maintenances.length})`, margin, y)
  y += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  if (maintenances.length === 0) {
    doc.setTextColor(...COLOR_MUTED)
    doc.text('Nenhuma intervenção de manutenção registrada no período selecionado.', margin, y)
    y += 6
  } else {
    maintenances.slice(0, 8).forEach((m) => {
      ensureSpace(6)
      const dateStr = new Date(m.createdAt).toLocaleDateString('pt-BR')
      const detail = m.filterElement
        ? `${m.filterElement} (${m.filterVolume})`
        : m.sensorType
          ? `Sensor ${m.sensorType}`
          : m.notes.slice(0, 55)
      doc.setTextColor(...COLOR_BLUE_900)
      doc.text(`• ${dateStr} — ${m.type}: ${detail} (Fiscal: ${m.inspectorName})`, margin + 1, y)
      y += 5.2
    })
  }

  // Stamp SHA-256 footer on every page
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(doc, margin, pageWidth, integrityHash, p, totalPages)
  }

  return doc
}

export function downloadTechnicalBulletinPdf(input: GenerateBulletinPdfInput): void {
  const doc = buildTechnicalBulletinPdf(input)
  doc.save(`boletim-tecnico-${input.well.code.toLowerCase()}-${input.periodEnd}.pdf`)
}

export function downloadCommunityBulletinPdf(input: {
  sectorLabel: string
  periodLabel: string
  wells: Well[]
  phMean: number
  turbidityMean: number
  temperatureMean: number
  sensorAvailabilityPct: number
  recurrentCriticalNames: string[]
  issuerName: string
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentW = pageWidth - margin * 2

  doc.setFillColor(...COLOR_BLUE_900)
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setFillColor(...COLOR_ORANGE_500)
  doc.rect(0, 30, pageWidth, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.text('BOLETIM COMUNITÁRIO DE QUALIDADE DA ÁGUA', margin, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Assentamento Santa Luzia — ${input.sectorLabel}  |  Período: ${input.periodLabel}  |  Liderança: ${input.issuerName}`,
    margin,
    22,
  )

  let y = 40
  doc.setTextColor(...COLOR_BLUE_900)
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.text('1. Indicadores Consolidados do Território', margin, y)
  y += 5

  // 4 KPI Cards
  const gap = 3.5
  const cardW = (contentW - gap * 3) / 4
  const cardH = 20
  const cards: { label: string; value: string; accent: Rgb }[] = [
    { label: 'PH MÉDIO', value: formatDecimalBR(input.phMean, 2), accent: COLOR_BLUE_500 },
    {
      label: 'TURBIDEZ MÉDIA',
      value: `${formatDecimalBR(input.turbidityMean, 2)} UNT`,
      accent: input.turbidityMean >= 5 ? COLOR_RED : input.turbidityMean >= 4 ? COLOR_AMBER : COLOR_GREEN,
    },
    {
      label: 'TEMPERATURA',
      value: `${formatDecimalBR(input.temperatureMean, 1)} °C`,
      accent: input.temperatureMean >= 25 ? COLOR_RED : COLOR_ORANGE_700,
    },
    {
      label: 'SENSORES ONLINE',
      value: `${input.sensorAvailabilityPct}%`,
      accent: input.sensorAvailabilityPct >= 80 ? COLOR_GREEN : COLOR_AMBER,
    },
  ]

  cards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + gap)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...COLOR_BORDER)
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD')
    doc.setFillColor(...c.accent)
    doc.rect(cx + 0.5, y + 0.4, cardW - 1, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLOR_BLUE_300)
    doc.text(c.label, cx + 3, y + 6.5)
    doc.setFontSize(12)
    doc.setTextColor(...c.accent)
    doc.text(c.value, cx + 3, y + 14.5)
  })
  y += cardH + 7

  if (input.recurrentCriticalNames.length > 0) {
    doc.setFillColor(254, 242, 242)
    doc.setDrawColor(252, 165, 165)
    doc.roundedRect(margin, y, contentW, 13, 2, 2, 'FD')
    doc.setTextColor(...COLOR_RED)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(
      `Alerta de recorrência (> 3 alertas críticos no período): ${input.recurrentCriticalNames.join(', ')}`,
      margin + 4,
      y + 8,
    )
    y += 18
  }

  // Horizontal bar chart of turbidity by well
  doc.setTextColor(...COLOR_BLUE_900)
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.text(`2. Comparativo de Turbidez por Poço (Limite: 5,0 UNT)`, margin, y)
  y += 5

  const maxTurb = Math.max(6, ...input.wells.map((w) => w.currentReading.turbidity))
  const labelW = 62
  const barMaxW = contentW - labelW - 22

  input.wells.slice(0, 10).forEach((w) => {
    const status = w.interdicted ? 'Crítico' : classifyWaterStatus(w.currentReading)
    const barColor = statusRgb(status)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_BLUE_900)
    doc.text(w.name.slice(0, 32), margin, y + 4)

    doc.setFillColor(238, 242, 248)
    doc.roundedRect(margin + labelW, y + 0.8, barMaxW, 4.2, 1, 1, 'F')

    const fillW = Math.max(2, (w.currentReading.turbidity / maxTurb) * barMaxW)
    doc.setFillColor(...barColor)
    doc.roundedRect(margin + labelW, y + 0.8, fillW, 4.2, 1, 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...barColor)
    doc.text(`${formatDecimalBR(w.currentReading.turbidity, 1)} UNT`, pageWidth - margin, y + 4, {
      align: 'right',
    })
    y += 7.5
  })

  y += 4
  doc.setTextColor(...COLOR_BLUE_900)
  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.text(`3. Situação Detalhada dos Poços (${input.wells.length})`, margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  input.wells.forEach((w) => {
    if (y > 268) return
    const status = w.interdicted ? 'INTERDITADO / EMERGÊNCIA' : classifyWaterStatus(w.currentReading)
    doc.text(
      `• ${w.name} (${w.sector}) — ${status} | pH ${formatDecimalBR(w.currentReading.ph)} | Turbidez ${formatDecimalBR(w.currentReading.turbidity)} UNT`,
      margin,
      y,
    )
    y += 5.5
  })

  doc.setFontSize(8)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(
    `Emitido em ${formatDateBR(new Date().toISOString())} pela Plataforma MIPC — Fundação Água Limpa.`,
    margin,
    280,
  )

  doc.save(`boletim-comunitario-${new Date().toISOString().slice(0, 10)}.pdf`)
}
