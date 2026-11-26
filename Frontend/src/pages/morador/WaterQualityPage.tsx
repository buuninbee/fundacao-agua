import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  LocateFixed,
  MapPin,
  MessageSquareWarning,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import {
  formatDateBR,
  formatDecimalBR,
  getResidentWaterGuidance,
} from '@/lib/waterRules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const LEVEL_STYLES = {
  safe: {
    card: 'border-emerald-300 bg-emerald-50',
    iconBg: 'bg-emerald-600 text-white',
    badge: 'excellent' as const,
    title: 'text-emerald-900',
    body: 'text-emerald-900/90',
    tipBg: 'border-emerald-200 bg-white',
    Icon: CheckCircle2,
  },
  caution: {
    card: 'border-amber-300 bg-amber-50',
    iconBg: 'bg-amber-600 text-white',
    badge: 'attention' as const,
    title: 'text-amber-950',
    body: 'text-amber-950/90',
    tipBg: 'border-amber-200 bg-white',
    Icon: AlertTriangle,
  },
  danger: {
    card: 'border-red-300 bg-red-50',
    iconBg: 'bg-red-600 text-white',
    badge: 'critical' as const,
    title: 'text-red-900',
    body: 'text-red-900/90',
    tipBg: 'border-red-200 bg-white',
    Icon: ShieldAlert,
  },
}

export function WaterQualityPage() {
  const navigate = useNavigate()
  const { wells, visits } = useMipc()

  // Default to Poço Água Branca #01 (normal/safe) so resident immediately sees a clear status card
  const defaultWell = wells.find((w) => w.id === 'well-ab-01') ?? wells[0]
  const [selectedWellId, setSelectedWellId] = useState(defaultWell?.id ?? '')
  const [query, setQuery] = useState('')
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoHint, setGeoHint] = useState('')

  const activeMaintenanceWellIds = useMemo(
    () => new Set(visits.filter((v) => v.status === 'Em Andamento').map((v) => v.wellId)),
    [visits],
  )

  const filteredWells = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? wells.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            w.sector.toLowerCase().includes(q) ||
            w.code.toLowerCase().includes(q),
        )
      : [...wells]

    if (userCoords) {
      // ponytail: Euclidean deg² sort is accurate enough within one settlement; Haversine if multi-city.
      list.sort(
        (a, b) =>
          (a.latitude - userCoords.lat) ** 2 +
          (a.longitude - userCoords.lng) ** 2 -
          ((b.latitude - userCoords.lat) ** 2 + (b.longitude - userCoords.lng) ** 2),
      )
    }
    return list
  }, [wells, query, userCoords])

  const selectedWell =
    wells.find((w) => w.id === selectedWellId) ?? filteredWells[0] ?? wells[0]

  const guidance = selectedWell
    ? getResidentWaterGuidance(selectedWell, activeMaintenanceWellIds.has(selectedWell.id))
    : null

  function handleLocateNearest() {
    if (!('geolocation' in navigator)) {
      setGeoHint('Ordenado pelo poço central do Assentamento.')
      setUserCoords({ lat: -15.7815, lng: -47.9948 })
      return
    }
    setGeoHint('Buscando poço mais próximo...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserCoords(coords)
        setGeoHint('Poços ordenados pela sua localização atual.')
      },
      () => {
        setUserCoords({ lat: -15.7815, lng: -47.9948 })
        setGeoHint('Localização aproximada do Setor Norte aplicada.')
      },
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Segurança da Água no Seu Setor
        </span>
        <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Como está a água do meu poço?
        </h1>
        <p className="mt-0.5 text-sm text-purple-900">
          Escolha seu setor para ver de forma simples se a água está segura para beber e cozinhar.
        </p>
      </div>

      {/* Search by neighborhood/sector + Geolocation */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-900" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome do poço, rua ou setor (ex.: Água Branca, Quadra 04)..."
            className="pl-9"
            aria-label="Buscar poço por setor ou nome"
          />
        </div>
        <Button type="button" variant="outline" onClick={handleLocateNearest} className="shrink-0">
          <LocateFixed className="h-4 w-4" />
          Poço mais próximo
        </Button>
      </div>
      {geoHint && <p className="text-xs text-purple-900 -mt-2">{geoHint}</p>}

      {/* Primary Visual Status Card (HU-MIPC-04) */}
      {selectedWell && guidance && (() => {
        const style = LEVEL_STYLES[guidance.level]
        const StatusIcon = style.Icon
        return (
          <Card className={`border-2 ${style.card}`}>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${style.iconBg} shadow-xs`}
                  >
                    <StatusIcon className="h-8 w-8" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <Badge variant={style.badge}>{guidance.statusLabel}</Badge>
                    <h2 className={`font-serif text-xl sm:text-2xl font-bold ${style.title}`}>
                      {selectedWell.name}
                    </h2>
                    <p className="text-xs text-purple-900 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {selectedWell.sector} · Atualizado há {selectedWell.lastTransmissionMinutesAgo}{' '}
                      min
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => navigate(`/morador/ouvidoria?wellId=${selectedWell.id}`)}
                  className="shrink-0"
                >
                  <MessageSquareWarning className="h-4 w-4" />
                  Relatar problema
                </Button>
              </div>

              <div className={`rounded-xl border p-4 space-y-1.5 ${style.tipBg}`}>
                <p className={`text-sm sm:text-base font-semibold ${style.title}`}>
                  {guidance.headline}
                </p>
                <p className={`text-sm ${style.body}`}>{guidance.instruction}</p>
              </div>

              <div className="rounded-xl border border-purple-500 bg-white/90 p-4 flex items-start gap-3">
                <Droplets className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900">{guidance.tipTitle}</p>
                  <p className="text-purple-900 mt-0.5">{guidance.tipBody}</p>
                </div>
              </div>

              <details className="text-xs text-purple-900">
                <summary className="cursor-pointer font-semibold text-blue-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm w-fit">
                  Ver dados técnicos dos sensores (opcional)
                </summary>
                <div className="mt-2.5 flex flex-wrap gap-4 rounded-lg border border-purple-500 bg-white px-3.5 py-2.5 tabular-nums">
                  <span>
                    <strong className="text-blue-900">pH:</strong>{' '}
                    {formatDecimalBR(selectedWell.currentReading.ph)}
                  </span>
                  <span>
                    <strong className="text-blue-900">Turbidez:</strong>{' '}
                    {formatDecimalBR(selectedWell.currentReading.turbidity)} UNT
                  </span>
                  <span>
                    <strong className="text-blue-900">Temperatura:</strong>{' '}
                    {formatDecimalBR(selectedWell.currentReading.temperature)} °C
                  </span>
                  <span>
                    <strong className="text-blue-900">Última manutenção:</strong>{' '}
                    {formatDateBR(selectedWell.lastMaintenanceDate)}
                  </span>
                </div>
              </details>
            </CardContent>
          </Card>
        )
      })()}

      {/* Simplified Sector Wells List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Poços do Assentamento Santa Luzia ({filteredWells.length})</CardTitle>
          <CardDescription>
            Toque em um poço para consultar a situação da água e orientações para sua casa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {filteredWells.length === 0 ? (
            <p className="text-sm text-purple-900 py-4 text-center">
              Nenhum poço encontrado para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            filteredWells.map((well) => {
              const g = getResidentWaterGuidance(well, activeMaintenanceWellIds.has(well.id))
              const style = LEVEL_STYLES[g.level]
              const isSelected = well.id === selectedWell?.id
              return (
                <button
                  key={well.id}
                  type="button"
                  onClick={() => setSelectedWellId(well.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left rounded-xl border p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                      : 'border-purple-600 bg-white hover:bg-purple-100'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-serif text-base font-bold text-blue-900 truncate">
                      {well.name}
                    </p>
                    <p className="text-xs text-purple-900 truncate">{well.sector}</p>
                  </div>
                  <Badge variant={style.badge} className="shrink-0">
                    {g.statusLabel}
                  </Badge>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
