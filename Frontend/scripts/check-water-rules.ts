import assert from 'node:assert/strict'
import {
  applyWorkshopRsvp,
  classifyBattery,
  classifyConnectivity,
  classifyRssi,
  classifyWaterStatus,
  computeBulletinIndicators,
  computeMetricStats,
  computeSectorConsolidation,
  filterReadingsByDateRange,
  formatDateBR,
  formatDecimalBR,
  formatOmbudsmanProtocol,
  formatUrgencyProtocol,
  generateIntegrityHash,
  getResidentWaterGuidance,
  hasCommunicationFailure,
  validateCalibrationInput,
  validateEmergencyInput,
  validateOmbudsmanInput,
} from '../src/lib/waterRules.ts'

// HU-MIPC-01: Normal / Excelente
assert.equal(classifyWaterStatus({ ph: 7.2, turbidity: 1.6, temperature: 21.4 }), 'Excelente')

// HU-MIPC-01: Atenção (turbidez 4 <= t < 5 ou pequena oscilação de pH)
assert.equal(classifyWaterStatus({ ph: 7.0, turbidity: 4.5, temperature: 22.0 }), 'Atenção')
assert.equal(classifyWaterStatus({ ph: 6.2, turbidity: 2.0, temperature: 22.0 }), 'Atenção')

// HU-MIPC-01 BDD Cenário 1: Crítico (turbidez 6.2 >= 5, pH < 6 ou > 9.5, temp >= 25)
assert.equal(classifyWaterStatus({ ph: 7.0, turbidity: 6.2, temperature: 23.0 }), 'Crítico')
assert.equal(classifyWaterStatus({ ph: 5.9, turbidity: 1.0, temperature: 22.0 }), 'Crítico')
assert.equal(classifyWaterStatus({ ph: 9.6, turbidity: 1.0, temperature: 22.0 }), 'Crítico')
assert.equal(classifyWaterStatus({ ph: 7.0, turbidity: 1.0, temperature: 25.0 }), 'Crítico')

// HU-MIPC-01: Falha de Comunicação (> 30 min)
assert.equal(hasCommunicationFailure(30), false)
assert.equal(hasCommunicationFailure(31), true)

// HU-MIPC-03: Estatísticas e filtro por período (incluindo período vazio)
const stats = computeMetricStats([2, 4, 6])
assert.equal(stats.mean, 4)
assert.equal(stats.min, 2)
assert.equal(stats.max, 6)
assert.ok(Math.abs(stats.stdDev - Math.sqrt(8 / 3)) < 1e-9)

const sampleReadings = [
  { id: '1', timestamp: '2026-11-10T10:00:00Z', ph: 7, turbidity: 2, temperature: 22, reservoirLevel: 80 },
  { id: '2', timestamp: '2026-11-18T10:00:00Z', ph: 6.2, turbidity: 6.2, temperature: 23.8, reservoirLevel: 64 },
]
assert.equal(filterReadingsByDateRange(sampleReadings, '2026-11-15', '2026-11-20').length, 1)
assert.equal(filterReadingsByDateRange(sampleReadings, '2026-10-01', '2026-10-31').length, 0)

// HU-MIPC-03: Hash SHA-256 determinístico
const h1 = await generateIntegrityHash('boletim-teste')
const h2 = await generateIntegrityHash('boletim-teste')
assert.equal(h1, h2)
assert.equal(h1.length, 64)

// Formatação pt-BR consistente (datas ISO sem drift de fuso e decimais com vírgula)
assert.equal(formatDateBR('2026-09-21'), '21/09/2026')
assert.equal(formatDecimalBR(6.2, 1), '6,2')
assert.equal(formatDecimalBR(4.4, 2), '4,40')

// HU-MIPC-04: tradução simplificada para o morador (verde / amarelo / vermelho)
const baseWell = {
  id: 'w1',
  code: 'P-01',
  name: 'Poço Água Branca #01',
  community: 'Assentamento Santa Luzia',
  sector: 'Setor Norte',
  latitude: -15.78,
  longitude: -47.99,
  affectedFamilies: 1000,
  reservoirLevel: 80,
  lastTransmissionMinutesAgo: 5,
  lastMaintenanceDate: '2026-10-01',
  nextMaintenanceDate: '2026-12-30',
  history: [],
}
assert.equal(
  getResidentWaterGuidance({ ...baseWell, currentReading: { ph: 7.2, turbidity: 1.5, temperature: 21 } }).level,
  'safe',
)
assert.equal(
  getResidentWaterGuidance({ ...baseWell, currentReading: { ph: 7.2, turbidity: 1.5, temperature: 21 } }, true).level,
  'caution',
)
assert.equal(
  getResidentWaterGuidance({ ...baseWell, currentReading: { ph: 6.2, turbidity: 6.2, temperature: 23 } }).level,
  'danger',
)

// HU-MIPC-06: protocolo OUV-AAAA-XXXXX e validação de poço obrigatório
assert.equal(formatOmbudsmanProtocol(2026, 142), 'OUV-2026-00142')
assert.equal(
  validateOmbudsmanInput({ wellId: '', category: 'Vazamento ou Dano Físico', description: 'Vazamento grande na torneira.' }).banner,
  'Selecione o poço comunitário referente à sua ocorrência para continuar',
)
assert.equal(
  validateOmbudsmanInput({ wellId: 'w1', category: 'Alteração de Odor', description: 'Cheiro forte e estranho saindo do poço hoje.' }).banner,
  undefined,
)

// HU-MIPC-07: consolidação e alerta de recorrência (> 3 alertas críticos)
const today = '2026-11-20'
const recurrentWell = {
  ...baseWell,
  currentReading: { ph: 6.2, turbidity: 6.2, temperature: 23 },
  history: [
    { id: 'r1', timestamp: '2026-11-10T10:00:00Z', ph: 6.2, turbidity: 5.5, temperature: 23, reservoirLevel: 70 },
    { id: 'r2', timestamp: '2026-11-12T10:00:00Z', ph: 6.2, turbidity: 5.8, temperature: 23, reservoirLevel: 68 },
    { id: 'r3', timestamp: '2026-11-15T10:00:00Z', ph: 6.2, turbidity: 6.0, temperature: 23, reservoirLevel: 66 },
    { id: 'r4', timestamp: '2026-11-18T10:00:00Z', ph: 6.2, turbidity: 6.2, temperature: 23, reservoirLevel: 64 },
  ],
}
const sector = computeSectorConsolidation([recurrentWell], 30, today)
assert.equal(sector.recurrentCriticalWells.length, 1)
assert.equal(sector.sensorAvailabilityPct, 100)

// HU-MIPC-08: protocolo URG, validação mínima e interdição no morador
assert.equal(formatUrgencyProtocol(2026, 12), 'URG-2026-00012')
assert.equal(
  validateEmergencyInput({
    wellId: 'w1',
    category: 'Desabastecimento Total',
    description: '',
    photosCount: 0,
    hasAudio: false,
  }).banner,
  'Forneça ao menos uma descrição detalhada, foto ou relato de áudio para confirmar a emergência',
)
assert.equal(
  getResidentWaterGuidance({ ...baseWell, interdicted: true, currentReading: { ph: 7.2, turbidity: 1.5, temperature: 21 } }).statusLabel,
  'Interditado / Emergência',
)

// HU-MIPC-09: RSVP com vagas, lista de espera e promoção automática ao desistir
let wk = {
  id: 'wk-test',
  title: 'Oficina',
  agenda: 'Pauta',
  facilitator: 'ONG',
  dateTime: '2026-11-25T14:00',
  location: 'Centro',
  maxSeats: 1,
  participants: [],
  createdAt: '2026-11-20T10:00:00Z',
}
const r1 = applyWorkshopRsvp(wk, 'João', 'join')
assert.equal(r1.outcome, 'confirmed')
wk = r1.workshop
const r2 = applyWorkshopRsvp(wk, 'Maria', 'join')
assert.equal(r2.outcome, 'waitlist')
wk = r2.workshop
const r3 = applyWorkshopRsvp(wk, 'João', 'cancel')
assert.equal(r3.outcome, 'cancelled')
assert.equal(r3.workshop.participants[0].name, 'Maria')
assert.equal(r3.workshop.participants[0].status, 'confirmed')

// HU-MIPC-11: telemetria IoT (bateria < 15% crítica, RSSI < -100 fraco, > 15 min offline)
assert.equal(classifyBattery(12), 'Crítica')
assert.equal(classifyBattery(25), 'Baixa')
assert.equal(classifyBattery(80), 'Normal')
assert.equal(classifyRssi(-108), 'Fraco')
assert.equal(classifyRssi(-79), 'Forte')
assert.equal(classifyConnectivity({ lastHeartbeatMinutesAgo: 16, rssiDbm: -80, packetLossPct: 0 }), 'Offline')
assert.equal(classifyConnectivity({ lastHeartbeatMinutesAgo: 5, rssiDbm: -108, packetLossPct: 22 }), 'Instável')
assert.equal(classifyConnectivity({ lastHeartbeatMinutesAgo: 3, rssiDbm: -74, packetLossPct: 1 }), 'Online')

// HU-MIPC-12: limites físicos dos coeficientes de calibração
assert.equal(validateCalibrationInput({ sensor: 'pH', offset: -0.1, slopePct: 96 }).banner, undefined)
assert.equal(
  validateCalibrationInput({ sensor: 'pH', offset: 0, slopePct: 75 }).banner,
  'Valor de offset fora dos limites tolerados pelo fabricante. Verifique a medição',
)
assert.equal(
  validateCalibrationInput({ sensor: 'Turbidez', offset: 3.5 }).banner,
  'Valor de offset fora dos limites tolerados pelo fabricante. Verifique a medição',
)

import { buildTechnicalBulletinPdf } from '../src/lib/bulletinPdf.ts'

// HU-MIPC-03: Indicadores do boletim e geração vetorial de PDF com gráficos
const mixedReadings = [
  { id: 'r1', timestamp: '2026-11-16T10:00:00Z', ph: 7.1, turbidity: 1.0, temperature: 20.5, reservoirLevel: 80 },
  { id: 'r2', timestamp: '2026-11-17T10:00:00Z', ph: 7.2, turbidity: 4.2, temperature: 24.0, reservoirLevel: 76 },
  { id: 'r3', timestamp: '2026-11-18T10:00:00Z', ph: 5.8, turbidity: 5.4, temperature: 26.0, reservoirLevel: 72 },
  { id: 'r4', timestamp: '2026-11-19T10:00:00Z', ph: 5.7, turbidity: 6.1, temperature: 25.5, reservoirLevel: 70 },
]
const ind = computeBulletinIndicators(mixedReadings)
assert.equal(ind.total, 4)
assert.equal(ind.excellentCount, 1)
assert.equal(ind.attentionCount, 1)
assert.equal(ind.criticalCount, 2)
assert.equal(ind.compliancePct, 25)
assert.equal(ind.maxConsecutiveCritical, 2)
assert.equal(ind.turbidityTrend, 'Em alta')
assert.ok(ind.iqaScore > 0 && ind.iqaScore < 100)

const pdfDoc = buildTechnicalBulletinPdf({
  protocolCode: 'BT-MIPC-2026-0099',
  well: { ...baseWell, currentReading: { ph: 5.7, turbidity: 6.1, temperature: 25.5 }, history: mixedReadings },
  periodStart: '2026-11-16',
  periodEnd: '2026-11-19',
  readings: mixedReadings,
  maintenances: [],
  issuerId: 'FISC-014',
  issuerName: 'Mariana Souza',
  integrityHash: 'A'.repeat(64),
  generatedAt: '2026-11-25T23:00:00.000Z',
})
const pdfBytes = new Uint8Array(pdfDoc.output('arraybuffer'))
const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 5))
assert.equal(pdfHeader, '%PDF-')
assert.ok(pdfBytes.byteLength > 4000, `PDF muito pequeno: ${pdfBytes.byteLength} bytes`)
assert.ok(pdfDoc.getNumberOfPages() >= 1)

console.log(`✓ Todas as regras sanitárias, morador, liderança, IoT, TI e PDF vetorial (${pdfBytes.byteLength} bytes, ${pdfDoc.getNumberOfPages()} pág.) passaram.`)
