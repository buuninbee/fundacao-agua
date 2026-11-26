import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertTriangle,
  CalendarClock,
  Droplet,
  MapPin,
  Radio,
  Thermometer,
  Waves,
  WifiOff,
  Wrench,
} from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import {
  classifyWaterStatus,
  formatCoordinatesWGS84,
  formatDateBR,
  formatDecimalBR,
  getCriticalReasons,
  hasCommunicationFailure,
} from '@/lib/waterRules'
import type { WaterStatus, Well } from '@/types/mipc'
import { WellsMap } from '@/components/WellsMap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type FilterStatus = 'Todos' | WaterStatus | 'Falha'

function statusToBadgeVariant(status: WaterStatus) {
  if (status === 'Crítico') return 'critical' as const
  if (status === 'Atenção') return 'attention' as const
  return 'excellent' as const
}

export function MonitoringPage() {
  const navigate = useNavigate()
  const { wells, visits, scheduleVisit, updateVisitStatus } = useMipc()

  const [activeTab, setActiveTab] = useState<'painel' | 'agenda'>('painel')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('Todos')
  const [selectedWellId, setSelectedWellId] = useState<string>(wells[0]?.id ?? '')

  // Visit scheduling modal state (HU-MIPC-01 BDD Scenario 2)
  const [visitModalWell, setVisitModalWell] = useState<Well | null>(null)
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [visitTime, setVisitTime] = useState('09:00')
  const [visitInspector, setVisitInspector] = useState('Mariana Souza (Fiscal de Campo)')
  const [visitReason, setVisitReason] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const counts = useMemo(() => {
    let critical = 0
    let attention = 0
    let excellent = 0
    let commFailure = 0

    wells.forEach((w) => {
      if (hasCommunicationFailure(w.lastTransmissionMinutesAgo)) {
        commFailure++
        return
      }
      const s = classifyWaterStatus(w.currentReading)
      if (s === 'Crítico') critical++
      else if (s === 'Atenção') attention++
      else excellent++
    })

    return { critical, attention, excellent, commFailure }
  }, [wells])

  const filteredWells = useMemo(() => {
    return wells.filter((well) => {
      if (statusFilter === 'Todos') return true
      const offline = hasCommunicationFailure(well.lastTransmissionMinutesAgo)
      if (statusFilter === 'Falha') return offline
      return !offline && classifyWaterStatus(well.currentReading) === statusFilter
    })
  }, [wells, statusFilter])

  const selectedWell = wells.find((w) => w.id === selectedWellId) ?? wells[0]

  const criticalWells = useMemo(
    () => wells.filter((w) => classifyWaterStatus(w.currentReading) === 'Crítico'),
    [wells],
  )
  const offlineWells = useMemo(
    () => wells.filter((w) => hasCommunicationFailure(w.lastTransmissionMinutesAgo)),
    [wells],
  )

  function openVisitModal(well: Well) {
    const reasons = getCriticalReasons(well.currentReading)
    const offline = hasCommunicationFailure(well.lastTransmissionMinutesAgo)
    const reasonParts = [...reasons]
    if (offline) {
      reasonParts.push(
        `Gateway IoT sem transmissão há ${well.lastTransmissionMinutesAgo} minutos (> 30 min)`,
      )
    }

    setVisitModalWell(well)
    setVisitReason(
      reasonParts.length > 0
        ? `Inspeção técnica motivada por alerta automático: ${reasonParts.join('; ')}.`
        : 'Inspeção preventiva de rotina nos filtros e sensores do poço.',
    )
  }

  function handleScheduleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!visitModalWell) return

    const status = classifyWaterStatus(visitModalWell.currentReading)
    scheduleVisit({
      wellId: visitModalWell.id,
      wellName: visitModalWell.name,
      location: `${visitModalWell.community} — ${visitModalWell.sector} (${visitModalWell.latitude.toFixed(4)}, ${visitModalWell.longitude.toFixed(4)})`,
      scheduledDate: visitDate,
      scheduledTime: visitTime,
      priority: status === 'Crítico' ? 'Alta' : status === 'Atenção' ? 'Média' : 'Normal',
      reason: visitReason,
      assignedInspector: visitInspector,
      recentSummary: `pH ${formatDecimalBR(visitModalWell.currentReading.ph)} | Turbidez ${formatDecimalBR(visitModalWell.currentReading.turbidity)} UNT | Temp. ${formatDecimalBR(visitModalWell.currentReading.temperature)} °C`,
    })

    setToastMessage(`Visita Técnica agendada para ${visitModalWell.name} em ${formatDateBR(visitDate)} às ${visitTime}.`)
    setVisitModalWell(null)
    setActiveTab('agenda')
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Telemetria IoT e Alertas Sanitários
          </span>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
            Monitoramento em Tempo Real
          </h1>
          <p className="mt-0.5 text-sm text-purple-900">
            Acompanhe pH, turbidez, temperatura, nível dos reservatórios e conectividade dos
            gateways IoT.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/fiscal/manutencao')}
        >
          <Wrench className="h-4 w-4" />
          Registrar Manutenção
        </Button>
      </div>

      {toastMessage && (
        <FeedbackBanner
          variant="success"
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      )}

      {/* Compact Critical & Communication Failure Strip */}
      {(criticalWells.length > 0 || offlineWells.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50/80 px-4 py-2.5 text-xs text-red-900">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {criticalWells.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                {criticalWells.length} alerta{criticalWells.length > 1 ? 's' : ''} crítico
                {criticalWells.length > 1 ? 's' : ''}:{' '}
                <span className="font-normal">
                  {criticalWells.map((w) => w.name).join(', ')}
                </span>
              </span>
            )}
            {offlineWells.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
                <WifiOff className="h-4 w-4 text-amber-700 shrink-0" />
                {offlineWells.length} sem sinal (&gt; 30 min):{' '}
                <span className="font-normal">
                  {offlineWells.map((w) => `${w.code} (${w.lastTransmissionMinutesAgo}m)`).join(', ')}
                </span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {criticalWells.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-red-300 bg-white text-red-800 hover:bg-red-100"
                onClick={() => {
                  setActiveTab('painel')
                  setStatusFilter('Crítico')
                  setSelectedWellId(criticalWells[0].id)
                }}
              >
                Filtrar críticos
              </Button>
            )}
            {offlineWells.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                onClick={() => {
                  setActiveTab('painel')
                  setStatusFilter('Falha')
                  setSelectedWellId(offlineWells[0].id)
                }}
              >
                Ver sem sinal
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="bg-white">
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Status Excelente</CardDescription>
            <CardTitle className="text-2xl text-emerald-700 tabular-nums">{counts.excellent}</CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            Dentro dos limites sanitários
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Em Atenção</CardDescription>
            <CardTitle className="text-2xl text-amber-700 tabular-nums">{counts.attention}</CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            Turbidez 4–5 UNT ou oscilação de pH
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Alerta Crítico</CardDescription>
            <CardTitle className="text-2xl text-red-600 tabular-nums">{counts.critical}</CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            Fora dos limites — ação imediata
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Falha de Sinal</CardDescription>
            <CardTitle className="text-2xl text-blue-900 tabular-nums">{counts.commFailure}</CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            Gateways sem dados há &gt; 30 min
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs: Monitoring Panel vs Field Visits Agenda */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'painel' | 'agenda')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="painel">
              <Radio className="h-4 w-4" />
              Mapa e Poços ({wells.length})
            </TabsTrigger>
            <TabsTrigger value="agenda">
              <CalendarClock className="h-4 w-4" />
              Agenda de Visitas de Campo ({visits.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === 'painel' && (
            <div className="flex flex-wrap gap-1.5">
              {(['Todos', 'Crítico', 'Atenção', 'Excelente', 'Falha'] as FilterStatus[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      statusFilter === f
                        ? 'border-blue-900 bg-blue-900 text-white'
                        : 'border-purple-600 bg-white text-blue-900 hover:bg-purple-200'
                    }`}
                  >
                    {f === 'Falha' ? 'Falha de Sinal' : f}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        <TabsContent value="painel" className="space-y-6">
          {/* Interactive Map + Selected Well Detail */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Mapa Georreferenciado — Assentamento Santa Luzia</CardTitle>
                    <CardDescription>
                      Clique em um marcador para inspecionar métricas. Poços críticos ficam
                      destacados em vermelho.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-purple-900">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Excelente
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Atenção
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Crítico
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-900" /> Sem sinal
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <WellsMap
                  wells={filteredWells.length > 0 ? filteredWells : wells}
                  selectedWellId={selectedWell?.id}
                  onSelectWell={(w) => setSelectedWellId(w.id)}
                  heightClassName="h-[340px]"
                />
              </CardContent>
            </Card>

            {/* Selected Well Detail Panel */}
            {selectedWell && (
              <Card className="flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-blue-400">
                        {selectedWell.code}
                      </span>
                      {hasCommunicationFailure(selectedWell.lastTransmissionMinutesAgo) ? (
                        <Badge variant="offline">
                          <WifiOff className="h-3 w-3" />
                          Sem sinal ({selectedWell.lastTransmissionMinutesAgo}m)
                        </Badge>
                      ) : (
                        <Badge
                          variant={statusToBadgeVariant(
                            classifyWaterStatus(selectedWell.currentReading),
                          )}
                        >
                          {classifyWaterStatus(selectedWell.currentReading)}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-1">{selectedWell.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {selectedWell.sector}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {hasCommunicationFailure(selectedWell.lastTransmissionMinutesAgo) && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 flex items-center gap-2">
                        <WifiOff className="h-4 w-4 shrink-0 text-amber-700" />
                        <span>
                          <strong>Falha de Comunicação:</strong> sem transmissão há{' '}
                          {selectedWell.lastTransmissionMinutesAgo} min.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <div
                        className={`rounded-lg border p-2.5 text-center ${
                          selectedWell.currentReading.ph < 6 || selectedWell.currentReading.ph > 9.5
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-purple-500 bg-purple-100 text-blue-900'
                        }`}
                      >
                        <p className="text-[11px] uppercase">pH</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums">
                          {formatDecimalBR(selectedWell.currentReading.ph)}
                        </p>
                      </div>
                      <div
                        className={`rounded-lg border p-2.5 text-center ${
                          selectedWell.currentReading.turbidity >= 5
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : selectedWell.currentReading.turbidity >= 4
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-purple-500 bg-purple-100 text-blue-900'
                        }`}
                      >
                        <p className="text-[11px] uppercase">Turbidez</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums">
                          {formatDecimalBR(selectedWell.currentReading.turbidity)}
                          <span className="text-[10px] font-normal ml-0.5">UNT</span>
                        </p>
                      </div>
                      <div
                        className={`rounded-lg border p-2.5 text-center ${
                          selectedWell.currentReading.temperature >= 25
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-purple-500 bg-purple-100 text-blue-900'
                        }`}
                      >
                        <p className="text-[11px] uppercase">Temp.</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums">
                          {formatDecimalBR(selectedWell.currentReading.temperature)}°C
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-purple-900">
                      <div className="flex justify-between">
                        <span>Nível do reservatório</span>
                        <strong className="text-blue-900 tabular-nums">{selectedWell.reservoirLevel}%</strong>
                      </div>
                      <div className="h-2 w-full rounded-full bg-purple-300 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${selectedWell.reservoirLevel}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1 border-t border-purple-500 pt-3 text-xs text-purple-900">
                      <p>
                        <strong className="text-blue-900">Famílias atendidas:</strong> ~
                        {selectedWell.affectedFamilies}
                      </p>
                      <p>
                        <strong className="text-blue-900">Última Manutenção:</strong>{' '}
                        {formatDateBR(selectedWell.lastMaintenanceDate)} (próxima:{' '}
                        {formatDateBR(selectedWell.nextMaintenanceDate)})
                      </p>
                      <p className="truncate" title={formatCoordinatesWGS84(selectedWell.latitude, selectedWell.longitude)}>
                        <strong className="text-blue-900">GPS:</strong>{' '}
                        {selectedWell.latitude.toFixed(4)}, {selectedWell.longitude.toFixed(4)}
                      </p>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 pt-0 flex flex-col gap-2">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => openVisitModal(selectedWell)}
                  >
                    <CalendarClock className="h-4 w-4" />
                    Agendar Visita Técnica
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      navigate(`/fiscal/manutencao?wellId=${selectedWell.id}`)
                    }
                  >
                    <Wrench className="h-4 w-4" />
                    Registrar Manutenção neste Poço
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Wells Operational List Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredWells.map((well) => {
              const status = classifyWaterStatus(well.currentReading)
              const offline = hasCommunicationFailure(well.lastTransmissionMinutesAgo)
              const isSelected = well.id === selectedWell?.id
              const needsAction = status !== 'Excelente' || offline

              return (
                <Card
                  key={well.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedWellId(well.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedWellId(well.id)
                    }
                  }}
                  className={`flex flex-col cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'ring-2 ring-blue-500 border-blue-500'
                      : 'hover:border-blue-300'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-blue-400 shrink-0">{well.code}</span>
                      {offline ? (
                        <Badge variant="offline" className="shrink-0">
                          <WifiOff className="h-3 w-3" />
                          Sem sinal ({well.lastTransmissionMinutesAgo}m)
                        </Badge>
                      ) : (
                        <Badge variant={statusToBadgeVariant(status)} className="shrink-0">
                          {status}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-1 text-base truncate" title={well.name}>
                      {well.name}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">{well.sector}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div
                        className={`rounded-md border p-2 ${
                          well.currentReading.ph < 6 || well.currentReading.ph > 9.5
                            ? 'bg-red-50 text-red-700 font-semibold border-red-200'
                            : 'bg-purple-100 text-blue-900 border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-[10px] text-purple-900">
                          <Droplet className="h-3 w-3" /> pH
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {formatDecimalBR(well.currentReading.ph)}
                        </span>
                      </div>

                      <div
                        className={`rounded-md border p-2 ${
                          well.currentReading.turbidity >= 5
                            ? 'bg-red-50 text-red-700 font-semibold border-red-200'
                            : well.currentReading.turbidity >= 4
                              ? 'bg-amber-50 text-amber-800 font-semibold border-amber-200'
                              : 'bg-purple-100 text-blue-900 border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-[10px] text-purple-900">
                          <Waves className="h-3 w-3" /> Turbidez
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {formatDecimalBR(well.currentReading.turbidity)} UNT
                        </span>
                      </div>

                      <div
                        className={`rounded-md border p-2 ${
                          well.currentReading.temperature >= 25
                            ? 'bg-red-50 text-red-700 font-semibold border-red-200'
                            : 'bg-purple-100 text-blue-900 border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-[10px] text-purple-900">
                          <Thermometer className="h-3 w-3" /> Temp.
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {formatDecimalBR(well.currentReading.temperature)} °C
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-purple-900 tabular-nums">
                      <span>Reservatório: {well.reservoirLevel}%</span>
                      <span>Sinal há {well.lastTransmissionMinutesAgo} min</span>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-purple-500">
                      <span className="text-[11px] text-purple-900 tabular-nums">
                        Últ. manut.: {formatDateBR(well.lastMaintenanceDate)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={needsAction ? 'secondary' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation()
                          openVisitModal(well)
                        }}
                      >
                        {needsAction ? 'Agendar Visita' : 'Inspeção Preventiva'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Field Visits Agenda Tab */}
        <TabsContent value="agenda">
          <Card>
            <CardHeader>
              <CardTitle>Agenda de Visitas Técnicas e Ordens de Manutenção</CardTitle>
              <CardDescription>
                Visitas criadas diretamente a partir dos alertas do monitoramento IoT.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {visits.length === 0 ? (
                <p className="text-sm text-purple-900 py-6 text-center">
                  Nenhuma visita técnica agendada no momento.
                </p>
              ) : (
                visits.map((visit) => (
                  <div
                    key={visit.id}
                    className="rounded-xl border border-purple-600 bg-purple-100/70 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            visit.priority === 'Alta'
                              ? 'critical'
                              : visit.priority === 'Média'
                                ? 'attention'
                                : 'secondary'
                          }
                        >
                          Prioridade {visit.priority}
                        </Badge>
                        <Badge
                          variant={
                            visit.status === 'Concluída'
                              ? 'excellent'
                              : visit.status === 'Em Andamento'
                                ? 'orange'
                                : 'default'
                          }
                        >
                          {visit.status}
                        </Badge>
                        <span className="text-xs font-semibold text-blue-900 tabular-nums">
                          {formatDateBR(visit.scheduledDate)} às {visit.scheduledTime}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-blue-900">
                        {visit.wellName}
                      </h3>
                      <p className="text-xs text-purple-900">{visit.location}</p>
                      <p className="text-sm text-blue-900">{visit.reason}</p>
                      <p className="text-xs text-purple-900">
                        <strong>Leitura na abertura:</strong> {visit.recentSummary} ·{' '}
                        <strong>Responsável:</strong> {visit.assignedInspector}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      {visit.status === 'Agendada' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="brand"
                          onClick={() => updateVisitStatus(visit.id, 'Em Andamento')}
                        >
                          Iniciar Visita
                        </Button>
                      )}
                      {visit.status !== 'Concluída' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateVisitStatus(visit.id, 'Concluída')}
                        >
                          Marcar Concluída
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/fiscal/manutencao?wellId=${visit.wellId}`)}
                      >
                        Registrar Manutenção
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Technical Visit Dialog (Pre-filled per HU-MIPC-01 BDD Scenario 2) */}
      <Dialog
        open={Boolean(visitModalWell)}
        onOpenChange={(open) => !open && setVisitModalWell(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Visita Técnica / Ordem de Manutenção</DialogTitle>
            <DialogDescription>
              Formulário pré-preenchido com localização e histórico recente das leituras IoT.
            </DialogDescription>
          </DialogHeader>

          {visitModalWell && (
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="rounded-lg border border-purple-600 bg-purple-100 p-3.5 text-xs space-y-1.5">
                <p className="font-serif text-base font-bold text-blue-900">
                  {visitModalWell.name} ({visitModalWell.code})
                </p>
                <p className="text-purple-900">
                  <strong>Localização:</strong> {visitModalWell.community} — {visitModalWell.sector}{' '}
                  ({formatCoordinatesWGS84(visitModalWell.latitude, visitModalWell.longitude)})
                </p>
                <p className="text-blue-900">
                  <strong>Leitura Atual:</strong> pH {formatDecimalBR(visitModalWell.currentReading.ph)} ·
                  Turbidez {formatDecimalBR(visitModalWell.currentReading.turbidity)} UNT · Temperatura{' '}
                  {formatDecimalBR(visitModalWell.currentReading.temperature)} °C
                </p>
                {visitModalWell.history.length > 0 && (
                  <div className="pt-1 border-t border-purple-500">
                    <p className="font-semibold text-blue-900 mb-1">
                      Histórico recente (últimas 3 leituras):
                    </p>
                    <ul className="space-y-0.5 text-purple-900">
                      {visitModalWell.history.slice(-3).map((h) => (
                        <li key={h.id}>
                          • {formatDateBR(h.timestamp)} — pH{' '}
                          {formatDecimalBR(h.ph)}, Turbidez {formatDecimalBR(h.turbidity)} UNT, Temp.{' '}
                          {formatDecimalBR(h.temperature)} °C
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="visit-date">Data da Visita</Label>
                  <Input
                    id="visit-date"
                    type="date"
                    required
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="visit-time">Horário Previsto</Label>
                  <Input
                    id="visit-time"
                    type="time"
                    required
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="visit-inspector">Agente / Fiscal Responsável</Label>
                <Input
                  id="visit-inspector"
                  required
                  value={visitInspector}
                  onChange={(e) => setVisitInspector(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="visit-reason">Motivo e Procedimento Planejado</Label>
                <Textarea
                  id="visit-reason"
                  required
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisitModalWell(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Confirmar Agendamento</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
