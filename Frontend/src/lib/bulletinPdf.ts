import { jsPDF } from 'jspdf'
import type {
  MaintenanceRecord,
  SensorReading,
  Well,
} from '@/types/mipc'
import {
  classifyWaterStatus,
  computeMetricStats,
  formatCoordinatesWGS84,
  formatDateBR,
  formatDecimalBR,
} from '@/lib/waterRules'

interface GenerateBulletinPdfInput {
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

export function downloadTechnicalBulletinPdf(input: GenerateBulletinPdfInput): void {
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

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16
  let y = 0

  // Official ONG letterhead (bg-blue-900 #001325)
  doc.setFillColor(0, 19, 37)
  doc.rect(0, 0, pageWidth, 34, 'F')

  // Orange accent bar (#fea842)
  doc.setFillColor(254, 168, 66)
  doc.rect(0, 34, pageWidth, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bold')
  doc.setFontSize(17)
  doc.text('FUNDAÇÃO ÁGUA LIMPA — MIPC', margin, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('BOLETIM TÉCNICO GEORREFERENCIADO DE QUALIDADE DA ÁGUA', margin, 21)
  doc.setFontSize(8.5)
  doc.text(
    `Protocolo: ${protocolCode}   |   Emissão: ${new Date(generatedAt).toLocaleString('pt-BR')}   |   Emissor: ${issuerName} (${issuerId})`,
    margin,
    28,
  )

  y = 45
  doc.setTextColor(0, 19, 37)

  // Section 1: Unit Identification & Georeferencing
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text('1. Identificação da Unidade e Georreferenciamento', margin, y)
  y += 6

  doc.setFillColor(245, 249, 253)
  doc.setDrawColor(213, 219, 228)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Unidade / Poço: ${well.name} (${well.code})`, margin + 4, y + 7)
  doc.text(
    `Comunidade / Setor: ${well.community} — ${well.sector} (~${well.affectedFamilies} famílias atendidas)`,
    margin + 4,
    y + 13,
  )
  doc.text(
    `Coordenadas GPS: ${formatCoordinatesWGS84(well.latitude, well.longitude)}`,
    margin + 4,
    y + 19,
  )
  doc.text(
    `Período Analisado: ${formatDateBR(periodStart)} a ${formatDateBR(periodEnd)}   |   Leituras válidas: ${readings.length}`,
    margin + 4,
    y + 25,
  )

  y += 36

  // Section 2: Statistical Summary
  const phStats = computeMetricStats(readings.map((r) => r.ph))
  const turbStats = computeMetricStats(readings.map((r) => r.turbidity))
  const tempStats = computeMetricStats(readings.map((r) => r.temperature))

  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text('2. Resumo Estatístico das Medições (Sensores IoT)', margin, y)
  y += 6

  const headers = ['Parâmetro', 'Média', 'Mínimo', 'Pico (Máx.)', 'Desvio Padrão', 'Limite Seguro']
  const colWidths = [36, 24, 24, 28, 30, 36]

  doc.setFillColor(0, 45, 88)
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  let x = margin + 2
  headers.forEach((h, i) => {
    doc.text(h, x, y + 5.5)
    x += colWidths[i]
  })
  y += 8

  const rows = [
    [
      'pH',
      formatDecimalBR(phStats.mean, 2),
      formatDecimalBR(phStats.min, 2),
      formatDecimalBR(phStats.max, 2),
      formatDecimalBR(phStats.stdDev, 2),
      '6,0 a 9,5',
    ],
    [
      'Turbidez (UNT)',
      formatDecimalBR(turbStats.mean, 2),
      formatDecimalBR(turbStats.min, 2),
      formatDecimalBR(turbStats.max, 2),
      formatDecimalBR(turbStats.stdDev, 2),
      '< 5,0 UNT',
    ],
    [
      'Temperatura (°C)',
      formatDecimalBR(tempStats.mean, 1),
      formatDecimalBR(tempStats.min, 1),
      formatDecimalBR(tempStats.max, 1),
      formatDecimalBR(tempStats.stdDev, 2),
      '< 25,0 °C',
    ],
  ]

  doc.setTextColor(0, 19, 37)
  doc.setFont('helvetica', 'normal')
  rows.forEach((row, rIdx) => {
    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 251, 253)
      doc.rect(margin, y, pageWidth - margin * 2, 7.5, 'F')
    }
    doc.setDrawColor(213, 219, 228)
    doc.line(margin, y + 7.5, pageWidth - margin, y + 7.5)
    let cx = margin + 2
    row.forEach((cell, i) => {
      doc.text(cell, cx, y + 5)
      cx += colWidths[i]
    })
    y += 7.5
  })

  y += 10

  // Section 3: Alerts / Anomalies in period
  const anomalies = readings.filter((r) => classifyWaterStatus(r) !== 'Excelente')
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text(`3. Alertas e Anomalias Detectadas no Período (${anomalies.length})`, margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  if (anomalies.length === 0) {
    doc.text('Nenhuma anomalia sanitária registrada no intervalo selecionado.', margin, y)
    y += 7
  } else {
    anomalies.slice(0, 8).forEach((a) => {
      const status = classifyWaterStatus(a)
      const dateStr = new Date(a.timestamp).toLocaleString('pt-BR')
      doc.text(
        `• [${status.toUpperCase()}] ${dateStr} — pH: ${a.ph.toFixed(1)} | Turbidez: ${a.turbidity.toFixed(1)} UNT | Temp.: ${a.temperature.toFixed(1)} °C`,
        margin + 2,
        y,
      )
      y += 5.5
    })
    if (anomalies.length > 8) {
      doc.text(`... e mais ${anomalies.length - 8} ocorrência(s) no histórico consolidado.`, margin + 2, y)
      y += 5.5
    }
  }

  y += 6

  // Section 4: Maintenances in period
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text(`4. Intervenções e Manutenções Registradas (${maintenances.length})`, margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  if (maintenances.length === 0) {
    doc.text('Nenhuma intervenção de manutenção registrada no período selecionado.', margin, y)
    y += 7
  } else {
    maintenances.slice(0, 5).forEach((m) => {
      const dateStr = new Date(m.createdAt).toLocaleDateString('pt-BR')
      const detail = m.filterElement
        ? `${m.filterElement} (${m.filterVolume})`
        : m.sensorType
          ? `Sensor ${m.sensorType}`
          : m.notes.slice(0, 55)
      doc.text(`• ${dateStr} — ${m.type}: ${detail} (Fiscal: ${m.inspectorName})`, margin + 2, y)
      y += 5.5
    })
  }

  // Footer with Integrity Hash
  const footerY = 272
  doc.setDrawColor(213, 219, 228)
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 45, 88)
  doc.text('VERIFICAÇÃO DE AUTENTICIDADE E INTEGRIDADE (SHA-256)', margin, footerY)
  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(98, 101, 105)
  doc.text(integrityHash, margin, footerY + 4.5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'Documento gerado eletronicamente pela Plataforma MIPC — Fundação Água Limpa (Assentamento Santa Luzia - DF).',
    margin,
    footerY + 10,
  )

  doc.save(`boletim-tecnico-${well.code.toLowerCase()}-${periodEnd}.pdf`)
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
  const margin = 16

  doc.setFillColor(0, 19, 37)
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setFillColor(254, 168, 66)
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

  let y = 42
  doc.setTextColor(0, 19, 37)
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text('Indicadores Consolidados do Território', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(
    `pH médio: ${formatDecimalBR(input.phMean, 2)}   |   Turbidez média: ${formatDecimalBR(input.turbidityMean, 2)} UNT   |   Temperatura média: ${formatDecimalBR(input.temperatureMean, 1)} °C   |   Sensores online: ${input.sensorAvailabilityPct}%`,
    margin,
    y,
  )
  y += 9

  if (input.recurrentCriticalNames.length > 0) {
    doc.setFillColor(254, 242, 242)
    doc.setDrawColor(252, 165, 165)
    doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 2, 2, 'FD')
    doc.setTextColor(185, 28, 28)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(
      `Alerta de recorrência (> 3 alertas críticos no período): ${input.recurrentCriticalNames.join(', ')}`,
      margin + 4,
      y + 8.5,
    )
    y += 20
    doc.setTextColor(0, 19, 37)
  }

  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text(`Situação dos Poços (${input.wells.length})`, margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  input.wells.forEach((w) => {
    const status = w.interdicted ? 'INTERDITADO / EMERGÊNCIA' : classifyWaterStatus(w.currentReading)
    doc.text(
      `• ${w.name} (${w.sector}) — ${status} | pH ${formatDecimalBR(w.currentReading.ph)} | Turbidez ${formatDecimalBR(w.currentReading.turbidity)} UNT`,
      margin,
      y,
    )
    y += 6
  })

  doc.setFontSize(8)
  doc.setTextColor(98, 101, 105)
  doc.text(
    `Emitido em ${formatDateBR(new Date().toISOString())} pela Plataforma MIPC — Fundação Água Limpa.`,
    margin,
    280,
  )

  doc.save(`boletim-comunitario-${new Date().toISOString().slice(0, 10)}.pdf`)
}
