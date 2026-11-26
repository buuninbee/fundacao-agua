import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BatteryLow,
  Cpu,
  Radio,
  Search,
  Signal,
  Terminal,
  WifiOff,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMipc } from '@/context/MipcStore'
import {
  classifyBattery,
  classifyConnectivity,
  classifyRssi,
  formatDecimalBR,
} from '@/lib/waterRules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type DeviceFilter = 'Todos' | 'Online' | 'Instável' | 'Offline' | 'Bateria Crítica'
type RangeWindow = '24h' | '7d' | '30d'

export function IotHealthPage() {
  const { iotDevices } = useMipc()

  const [filter, setFilter] = useState<DeviceFilter>('Todos')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(iotDevices[0]?.id ?? '')
  const [range, setRange] = useState<RangeWindow>('24h')
  const [alertNotice, setAlertNotice] = useState<string | null>(null)

  const summary = useMemo(() => {
    let online = 0
    let unstable = 0
    let offline = 0
    let lowBattery = 0
    iotDevices.forEach((d) => {
      const c = classifyConnectivity(d)
      if (c === 'Online') online++
      else if (c === 'Instável') unstable++
      else offline++
      if (classifyBattery(d.batteryPct) === 'Crítica') lowBattery++
    })
    return { online, unstable, offline, lowBattery }
  }, [iotDevices])

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return iotDevices.filter((d) => {
      const conn = classifyConnectivity(d)
      const bat = classifyBattery(d.batteryPct)
      if (filter === 'Bateria Crítica' && bat !== 'Crítica') return false
      if (
        (filter === 'Online' || filter === 'Instável' || filter === 'Offline') &&
        conn !== filter
      ) {
        return false
      }
      if (!q) return true
      return d.nodeId.toLowerCase().includes(q) || d.wellName.toLowerCase().includes(q)
    })
  }, [iotDevices, filter, search])

  const selected =
    filteredDevices.find((d) => d.id === selectedId) ?? filteredDevices[0] ?? iotDevices[0]

  const chartSeries = useMemo(() => {
    if (!selected) return []
    if (range === '24h') return selected.series24h
    const prefix = range === '7d' ? 'Dia ' : 'Sem '
    return selected.series24h.map((pt, idx) => ({
      label: `${prefix}${idx + 1}`,
      batteryPct: Math.min(100, pt.batteryPct + (range === '30d' ? 6 : 3)),
      rssiDbm: pt.rssiDbm + (idx % 2 === 0 ? 1 : -1),
    }))
  }, [selected, range])

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Infraestrutura de Hardware · HU-MIPC-11
        </span>
        <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Saúde e Diagnóstico dos Equipamentos IoT
        </h1>
        <p className="mt-0.5 text-sm text-purple-900">
          Acompanhe bateria solar, sinal RSSI, perda de pacotes, heartbeat (&gt; 15 min offline) e
          logs brutos dos nós em campo.
        </p>
      </div>

      {alertNotice && (
        <FeedbackBanner
          variant="success"
          message={alertNotice}
          onDismiss={() => setAlertNotice(null)}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Online</CardDescription>
            <CardTitle className="text-2xl text-emerald-700 tabular-nums">
              {summary.online}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            RSSI forte/moderado e perda ≤ 10%
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Conectividade Instável</CardDescription>
            <CardTitle className="text-2xl text-amber-700 tabular-nums">
              {summary.unstable}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            RSSI &lt; -100 dBm ou perda &gt; 10%
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Dispositivo Offline</CardDescription>
            <CardTitle className="text-2xl text-blue-900 tabular-nums">
              {summary.offline}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            Sem heartbeat há mais de 15 min
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="text-xs">Bateria Crítica</CardDescription>
            <CardTitle className="text-2xl text-red-600 tabular-nums">
              {summary.lowBattery}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 text-[11px] text-purple-900">
            Carga abaixo de 15% — manutenção urgente
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(['Todos', 'Online', 'Instável', 'Offline', 'Bateria Crítica'] as DeviceFilter[]).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  filter === f
                    ? 'border-blue-900 bg-blue-900 text-white'
                    : 'border-purple-600 bg-white text-blue-900 hover:bg-purple-200'
                }`}
              >
                {f === 'Instável' ? 'Conectividade Instável' : f}
              </button>
            ),
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-900" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por ID do nó ou poço..."
            className="pl-9 h-9"
            aria-label="Filtrar dispositivos IoT"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Devices List */}
        <div className="lg:col-span-2 space-y-2.5">
          {filteredDevices.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-purple-900">
                Nenhum equipamento IoT corresponde ao filtro selecionado.
              </CardContent>
            </Card>
          ) : (
            filteredDevices.map((d) => {
              const conn = classifyConnectivity(d)
              const bat = classifyBattery(d.batteryPct)
              const rssiLevel = classifyRssi(d.rssiDbm)
              const isSelected = d.id === selected?.id
              const criticalBat = bat === 'Crítica'

              return (
                <Card
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedId(d.id)
                    }
                  }}
                  className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    criticalBat ? 'border-red-300 bg-red-50/50' : ''
                  } ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-blue-300'}`}
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-blue-500">{d.nodeId}</span>
                      <div className="flex items-center gap-1.5">
                        {criticalBat && (
                          <Badge variant="critical">
                            <BatteryLow className="h-3 w-3" />
                            Bateria {d.batteryPct}%
                          </Badge>
                        )}
                        <Badge
                          variant={
                            conn === 'Offline'
                              ? 'offline'
                              : conn === 'Instável'
                                ? 'attention'
                                : 'excellent'
                          }
                        >
                          {conn === 'Offline' ? 'Dispositivo Offline' : conn}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <p className="font-serif text-base font-bold text-blue-900 truncate">
                        {d.wellName}
                      </p>
                      <p className="text-[11px] text-purple-900">
                        {d.protocol} · Firmware {d.firmwareVersion}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                      <div
                        className={`rounded-md border px-2 py-1.5 ${
                          criticalBat
                            ? 'border-red-300 bg-red-50 text-red-800 font-semibold'
                            : 'border-transparent bg-purple-100 text-blue-900'
                        }`}
                      >
                        <span className="block text-[10px] text-purple-900">Bateria</span>
                        <strong>{d.batteryPct}%</strong> ({formatDecimalBR(d.solarVoltage)}V)
                      </div>
                      <div
                        className={`rounded-md border px-2 py-1.5 ${
                          rssiLevel === 'Fraco'
                            ? 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'
                            : 'border-transparent bg-purple-100 text-blue-900'
                        }`}
                      >
                        <span className="block text-[10px] text-purple-900">RSSI</span>
                        <strong>{d.rssiDbm} dBm</strong>
                      </div>
                      <div
                        className={`rounded-md border px-2 py-1.5 ${
                          d.packetLossPct > 10
                            ? 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'
                            : 'border-transparent bg-purple-100 text-blue-900'
                        }`}
                      >
                        <span className="block text-[10px] text-purple-900">Perda 24h</span>
                        <strong>{formatDecimalBR(d.packetLossPct)}%</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-purple-900 tabular-nums">
                      Último heartbeat há <strong>{d.lastHeartbeatMinutesAgo} min</strong>
                    </p>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Selected Node Diagnostics & Raw Payload */}
        {selected && (() => {
          const conn = classifyConnectivity(selected)
          const bat = classifyBattery(selected.batteryPct)
          return (
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-500">
                      {selected.nodeId} · {selected.protocol} · {selected.firmwareVersion}
                    </span>
                    <CardTitle className="mt-1">{selected.wellName}</CardTitle>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setAlertNotice(
                        `Alerta de infraestrutura disparado (E-mail/Webhook/Push) para manutenção do nó ${selected.nodeId}.`,
                      )
                    }
                  >
                    <Cpu className="h-4 w-4" />
                    Acionar Suporte Hardware
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {bat === 'Crítica' && (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Alerta de Bateria Crítica ({selected.batteryPct}%):</strong> carga
                      abaixo de 15%. Verifique painel solar, controlador de carga e substitua a
                      bateria LiFePO4.
                    </span>
                  </div>
                )}

                {(conn === 'Instável' || conn === 'Offline') && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex items-start gap-2.5">
                    {conn === 'Offline' ? (
                      <WifiOff className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    ) : (
                      <Signal className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <span>
                      <strong>
                        {conn === 'Offline'
                          ? `Dispositivo Offline (${selected.lastHeartbeatMinutesAgo} min sem heartbeat):`
                          : `Risco de Conectividade (RSSI ${selected.rssiDbm} dBm · perda ${formatDecimalBR(selected.packetLossPct)}%):`}
                      </strong>{' '}
                      recomenda-se verificar a antena física, cabos coaxiais e o posicionamento do
                      módulo de rádio em campo.
                    </span>
                  </div>
                )}

                <Tabs defaultValue="tendencia">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <TabsList>
                      <TabsTrigger value="tendencia">
                        <Radio className="h-4 w-4" />
                        Tendência Bateria &amp; RSSI
                      </TabsTrigger>
                      <TabsTrigger value="raw">
                        <Terminal className="h-4 w-4" />
                        Logs Brutos (Raw Payload)
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-1">
                      {(['24h', '7d', '30d'] as RangeWindow[]).map((r) => (
                        <Button
                          key={r}
                          type="button"
                          size="sm"
                          variant={range === r ? 'brand' : 'outline'}
                          className="h-7 px-2.5 text-xs"
                          onClick={() => setRange(r)}
                        >
                          {r}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <TabsContent value="tendencia">
                    <div className="h-[250px] w-full rounded-lg border border-purple-600 bg-purple-100/40 p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#d5dbe4" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#001325' }} />
                          <YAxis
                            yAxisId="bat"
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: '#002d58' }}
                            label={{
                              value: 'Bat %',
                              angle: -90,
                              position: 'insideLeft',
                              fill: '#002d58',
                              fontSize: 10,
                            }}
                          />
                          <YAxis
                            yAxisId="rssi"
                            orientation="right"
                            domain={[-120, -60]}
                            tick={{ fontSize: 11, fill: '#dc2626' }}
                            label={{
                              value: 'dBm',
                              angle: 90,
                              position: 'insideRight',
                              fill: '#dc2626',
                              fontSize: 10,
                            }}
                          />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line
                            yAxisId="bat"
                            type="monotone"
                            dataKey="batteryPct"
                            name="Bateria (%)"
                            stroke="#002d58"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            isAnimationActive={false}
                          />
                          <Line
                            yAxisId="rssi"
                            type="monotone"
                            dataKey="rssiDbm"
                            name="RSSI (dBm)"
                            stroke="#dc2626"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>

                  <TabsContent value="raw" className="space-y-3">
                    <div className="rounded-lg border border-purple-600 bg-blue-900 text-blue-100 p-4 font-mono text-xs space-y-3 overflow-x-auto">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-orange-400 font-sans font-semibold mb-1">
                          Frame Hexadecimal ({selected.protocol})
                        </p>
                        <code>{selected.rawPayloadHex}</code>
                      </div>
                      <div className="border-t border-blue-800 pt-3">
                        <p className="text-[10px] uppercase tracking-wider text-orange-400 font-sans font-semibold mb-1">
                          Payload Decodificado (JSON)
                        </p>
                        <pre className="whitespace-pre-wrap break-all">
                          {JSON.stringify(JSON.parse(selected.rawPayloadJson), null, 2)}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )
        })()}
      </div>
    </div>
  )
}
