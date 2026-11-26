import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Share2 } from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import { downloadCommunityBulletinPdf } from '@/lib/bulletinPdf'
import {
  classifyWaterStatus,
  computeSectorConsolidation,
  formatDateBR,
  formatDecimalBR,
  hasCommunicationFailure,
} from '@/lib/waterRules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PERIOD_OPTIONS = [
  { value: '15', label: 'Visão Quinzenal (15 dias)' },
  { value: '30', label: 'Visão Mensal (30 dias)' },
]

export function IndicatorsPage() {
  const { wells } = useMipc()
  const [periodDays, setPeriodDays] = useState<'15' | '30'>('30')
  const [sectorFilter, setSectorFilter] = useState('Todos')
  const [feedback, setFeedback] = useState<string | null>(null)

  const sectors = useMemo(() => {
    const unique = Array.from(new Set(wells.map((w) => w.sector.split('—')[0].trim())))
    return ['Todos', ...unique]
  }, [wells])

  const sectorWells = useMemo(() => {
    if (sectorFilter === 'Todos') return wells
    return wells.filter((w) => w.sector.startsWith(sectorFilter))
  }, [wells, sectorFilter])

  const days = Number(periodDays)
  const consolidated = useMemo(
    () => computeSectorConsolidation(sectorWells, days),
    [sectorWells, days],
  )

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === periodDays)?.label ?? 'Mensal'
  const sectorLabel = sectorFilter === 'Todos' ? 'Todos os Setores' : sectorFilter

  function handleDownloadPdf() {
    downloadCommunityBulletinPdf({
      sectorLabel,
      periodLabel,
      wells: sectorWells,
      phMean: consolidated.phMean,
      turbidityMean: consolidated.turbidityMean,
      temperatureMean: consolidated.temperatureMean,
      sensorAvailabilityPct: consolidated.sensorAvailabilityPct,
      recurrentCriticalNames: consolidated.recurrentCriticalWells.map((r) => r.well.name),
      issuerName: 'Dona Rosa Oliveira (LID-003)',
    })
    setFeedback(`Boletim Comunitário (${sectorLabel} · ${periodLabel}) exportado em PDF.`)
  }

  async function handleShareGroup() {
    const lines = [
      `Boletim Comunitário MIPC — ${sectorLabel} (${periodLabel})`,
      `pH médio: ${formatDecimalBR(consolidated.phMean, 2)} | Turbidez média: ${formatDecimalBR(consolidated.turbidityMean, 2)} UNT | Sensores online: ${consolidated.sensorAvailabilityPct}%`,
      ...sectorWells.map((w) => {
        const s = w.interdicted ? 'Interditado / Emergência' : classifyWaterStatus(w.currentReading)
        return `• ${w.name}: ${s}`
      }),
    ].join('\n')

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Boletim Comunitário — Fundação Água Limpa', text: lines })
        setFeedback('Boletim compartilhado com o grupo do setor.')
        return
      } catch {
        // User cancelled or Web Share blocked; fall through to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(lines)
      setFeedback(
        'Resumo otimizado do boletim copiado para a área de transferência — pronto para colar no grupo de WhatsApp do setor.',
      )
    } else {
      setFeedback('Resumo do boletim pronto para envio às famílias do setor.')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Transparência Territorial · HU-MIPC-07
        </span>
        <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Boletins e Indicadores Consolidados
        </h1>
        <p className="mt-0.5 text-sm text-purple-900">
          Acompanhe médias quinzenais e mensais dos poços do assentamento e compartilhe o boletim
          comunitário com as famílias.
        </p>
      </div>

      {feedback && (
        <FeedbackBanner variant="success" message={feedback} onDismiss={() => setFeedback(null)} />
      )}

      {/* Recurrence Alert (> 3 critical alerts in the period) */}
      {consolidated.recurrentCriticalWells.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              Alerta de Recorrência — Investigação Prioritária Sugerida
            </p>
            <p className="text-xs mt-1">
              Poço(s) com mais de 3 alertas críticos no período:{' '}
              {consolidated.recurrentCriticalWells
                .map((r) => `${r.well.name} (${r.criticalCount} alertas)`)
                .join(', ')}
              .
            </p>
          </div>
        </div>
      )}

      {/* Filters + Export / Share Actions */}
      <Card>
        <CardContent className="p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="grid gap-4 sm:grid-cols-2 flex-1">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="ind-sector">Setor Representado</Label>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger id="ind-sector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'Todos' ? 'Todos os setores do assentamento' : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="ind-period">Período Consolidado</Label>
              <Select
                value={periodDays}
                onValueChange={(v) => setPeriodDays(v as '15' | '30')}
              >
                <SelectTrigger id="ind-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={handleShareGroup}>
              <Share2 className="h-4 w-4" />
              Compartilhar no Grupo do Setor
            </Button>
            <Button type="button" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
              Gerar Boletim Comunitário (.pdf)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Sanitary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs">pH Médio</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimalBR(consolidated.phMean, 2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-[11px] text-purple-900">
            Faixa segura: 6,0 a 9,5
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs">Turbidez Média</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimalBR(consolidated.turbidityMean, 2)} UNT
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-[11px] text-purple-900">
            Limite sanitário: &lt; 5,0 UNT
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs">Temperatura Média</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimalBR(consolidated.temperatureMean, 1)} °C
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-[11px] text-purple-900">
            Ideal: &lt; 25,0 °C
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs">Disponibilidade IoT</CardDescription>
            <CardTitle className="text-2xl text-emerald-700 tabular-nums">
              {consolidated.sensorAvailabilityPct}%
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-[11px] text-purple-900">
            {consolidated.totalReadings} leituras consolidadas
          </CardContent>
        </Card>
      </div>

      {/* Consolidated Wells Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Panorama dos Poços — {sectorLabel}</CardTitle>
          <CardDescription>
            Dados consolidados prontos para diálogo com a Fundação Água Limpa e órgãos públicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-purple-600">
            <table className="w-full text-left text-sm">
              <thead className="bg-blue-500 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5">Poço / Setor</th>
                  <th className="px-4 py-2.5">Situação</th>
                  <th className="px-4 py-2.5 text-right">pH</th>
                  <th className="px-4 py-2.5 text-right">Turbidez</th>
                  <th className="px-4 py-2.5 text-right">Famílias</th>
                  <th className="px-4 py-2.5 text-right">Últ. Manut.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500 bg-white">
                {sectorWells.map((well) => {
                  const offline = hasCommunicationFailure(well.lastTransmissionMinutesAgo)
                  const status = classifyWaterStatus(well.currentReading)
                  return (
                    <tr key={well.id} className="even:bg-purple-100/50">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-blue-900">{well.name}</p>
                        <p className="text-xs text-purple-900">{well.sector}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {well.interdicted ? (
                          <Badge variant="critical">Interditado / Emergência</Badge>
                        ) : offline ? (
                          <Badge variant="offline">Sem sinal</Badge>
                        ) : (
                          <Badge
                            variant={
                              status === 'Crítico'
                                ? 'critical'
                                : status === 'Atenção'
                                  ? 'attention'
                                  : 'excellent'
                            }
                          >
                            {status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatDecimalBR(well.currentReading.ph)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatDecimalBR(well.currentReading.turbidity)} UNT
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        ~{well.affectedFamilies}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-purple-900">
                        {formatDateBR(well.lastMaintenanceDate)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
