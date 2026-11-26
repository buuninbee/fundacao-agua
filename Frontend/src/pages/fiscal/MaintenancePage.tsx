import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import {
  Camera,
  LocateFixed,
  Upload,
  Wrench,
} from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import { formatDateBR, MAX_PHOTO_SIZE_BYTES } from '@/lib/waterRules'
import type {
  FilterMediaElement,
  MaintenanceType,
  SensorType,
} from '@/types/mipc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const MAINTENANCE_TYPES: MaintenanceType[] = [
  'Troca de Mídia Filtrante',
  'Calibração de Sensores',
  'Substituição de Sensores Eletrônicos',
  'Manutenção Preventiva / Corretiva Geral',
]

const FILTER_ELEMENTS: FilterMediaElement[] = [
  'Areia de Quartzo',
  'Pedregulho / Cascalho de Sustentação',
  'Carvão Ativado Granulado',
]

const SENSOR_TYPES: SensorType[] = ['pH', 'Turbidez', 'Temperatura']

interface FormErrors {
  wellId?: boolean
  filterElement?: boolean
  filterVolume?: boolean
  sensorType?: boolean
  calibrationDateTime?: boolean
  bufferSolution?: boolean
  readingBefore?: boolean
  readingAfter?: boolean
  photo?: boolean
  banner?: string
}

export function MaintenancePage() {
  const [searchParams] = useSearchParams()
  const { wells, maintenances, addMaintenance } = useMipc()

  const initialWellId = searchParams.get('wellId') ?? wells[1]?.id ?? wells[0]?.id ?? ''
  const [wellId, setWellId] = useState(initialWellId)
  const [type, setType] = useState<MaintenanceType>('Troca de Mídia Filtrante')

  // Conditional: Filter Media
  const [filterElement, setFilterElement] = useState<FilterMediaElement | ''>('')
  const [filterVolume, setFilterVolume] = useState('')

  // Conditional: Sensor Calibration / Replacement
  const [sensorType, setSensorType] = useState<SensorType | ''>('pH')
  const [calibrationDateTime, setCalibrationDateTime] = useState(() =>
    new Date().toISOString().slice(0, 16),
  )
  const [bufferSolution, setBufferSolution] = useState('')
  const [readingBefore, setReadingBefore] = useState('')
  const [readingAfter, setReadingAfter] = useState('')

  const [notes, setNotes] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoErrorDetail, setPhotoErrorDetail] = useState('')

  const selectedWell = wells.find((w) => w.id === wellId)
  const [gpsCoords, setGpsCoords] = useState(() => ({
    latitude: selectedWell?.latitude ?? -15.7861,
    longitude: selectedWell?.longitude ?? -47.9854,
  }))
  const [gpsStatus, setGpsStatus] = useState('GPS do dispositivo')

  const [errors, setErrors] = useState<FormErrors>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (selectedWell) {
      setGpsCoords({
        latitude: selectedWell.latitude,
        longitude: selectedWell.longitude,
      })
    }
  }, [selectedWell])

  function handleCaptureGps() {
    if ('geolocation' in navigator) {
      setGpsStatus('Obtendo GPS...')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: Number(pos.coords.latitude.toFixed(5)),
            longitude: Number(pos.coords.longitude.toFixed(5)),
          })
          setGpsStatus('GPS capturado')
        },
        () => {
          setGpsCoords({
            latitude: selectedWell?.latitude ?? -15.7861,
            longitude: selectedWell?.longitude ?? -47.9854,
          })
          setGpsStatus('Sincronizado com o poço')
        },
      )
    } else {
      setGpsStatus('Sincronizado com o poço')
    }
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setPhotoErrorDetail('')
    if (!file) return

    const validMime = file.type === 'image/jpeg' || file.type === 'image/png'
    if (!validMime) {
      setPhotoName('')
      setPhotoDataUrl('')
      setPhotoErrorDetail('Formato inválido. Envie apenas imagens .jpg ou .png.')
      setErrors((prev) => ({ ...prev, photo: true }))
      return
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoName('')
      setPhotoDataUrl('')
      setPhotoErrorDetail('Arquivo excede o limite de 5 MB.')
      setErrors((prev) => ({ ...prev, photo: true }))
      return
    }

    setPhotoName(file.name)
    setErrors((prev) => ({ ...prev, photo: false }))

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSuccessMessage(null)

    const nextErrors: FormErrors = {}
    if (!wellId) nextErrors.wellId = true

    const isFilterSwap = type === 'Troca de Mídia Filtrante'
    const isSensorWork =
      type === 'Calibração de Sensores' || type === 'Substituição de Sensores Eletrônicos'

    if (isFilterSwap) {
      if (!filterElement) nextErrors.filterElement = true
      if (!filterVolume.trim()) nextErrors.filterVolume = true
    }

    if (isSensorWork) {
      if (!sensorType) nextErrors.sensorType = true
      if (!calibrationDateTime) nextErrors.calibrationDateTime = true
      if (!bufferSolution.trim()) nextErrors.bufferSolution = true
      if (!readingBefore.trim()) nextErrors.readingBefore = true
      if (!readingAfter.trim()) nextErrors.readingAfter = true
    }

    if (!photoName) {
      nextErrors.photo = true
    }

    if (Object.keys(nextErrors).length > 0) {
      // Exact BDD HU-MIPC-02 Scenario 2 message when missing filter element or photo
      nextErrors.banner =
        nextErrors.filterElement || nextErrors.photo
          ? 'Selecione o item mantido e anexe pelo menos uma foto comprovatória para concluir o registro'
          : 'Preencha todos os campos obrigatórios destacados em vermelho para concluir o registro.'
      setErrors(nextErrors)
      return
    }

    if (!selectedWell) return

    addMaintenance({
      wellId: selectedWell.id,
      wellName: selectedWell.name,
      type,
      filterElement: isFilterSwap && filterElement ? filterElement : undefined,
      filterVolume: isFilterSwap ? filterVolume.trim() : undefined,
      sensorType: isSensorWork && sensorType ? sensorType : undefined,
      calibrationDateTime: isSensorWork ? calibrationDateTime : undefined,
      bufferSolution: isSensorWork ? bufferSolution.trim() : undefined,
      readingBefore: isSensorWork ? readingBefore.trim() : undefined,
      readingAfter: isSensorWork ? readingAfter.trim() : undefined,
      notes: notes.trim() || 'Intervenção realizada dentro do protocolo preventivo da ONG.',
      photoName,
      photoDataUrl,
      gpsCoords,
      inspectorName: 'Mariana Souza',
    })

    // Exact BDD HU-MIPC-02 Scenario 1 confirmation message
    setSuccessMessage('Manutenção registrada com sucesso')
    setErrors({})
    setFilterElement('')
    setFilterVolume('')
    setBufferSolution('')
    setReadingBefore('')
    setReadingAfter('')
    setNotes('')
    setPhotoName('')
    setPhotoDataUrl('')
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Intervenções de Campo e Confiabilidade
        </span>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Manutenção Preventiva e Troca de Filtros
        </h1>
        <p className="mt-1 text-sm text-purple-900">
          Registre trocas de mídia filtrante, calibrações e substituições de sensores com
          evidência fotográfica e georreferenciamento automático.
        </p>
      </div>

      {successMessage && (
        <FeedbackBanner
          variant="success"
          message={`${successMessage} — Histórico e data de próxima manutenção preventiva atualizados no painel do poço.`}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      {errors.banner && <FeedbackBanner variant="error" message={errors.banner} />}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Maintenance Registration Form */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-500" />
              Novo Registro de Manutenção
            </CardTitle>
            <CardDescription>
              Ao salvar, a data de &ldquo;Última Manutenção Preventiva&rdquo; do poço é atualizada e
              o ciclo de 90 dias é reiniciado automaticamente.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="mnt-well">Poço Comunitário *</Label>
                  <Select
                    value={wellId}
                    onValueChange={(v) => {
                      setWellId(v)
                      setErrors((prev) => ({ ...prev, wellId: false }))
                    }}
                  >
                    <SelectTrigger
                      id="mnt-well"
                      className={errors.wellId ? 'border-red-500 ring-1 ring-red-500' : ''}
                    >
                      <SelectValue placeholder="Selecione o poço" />
                    </SelectTrigger>
                    <SelectContent>
                      {wells.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="mnt-type">Tipo de Intervenção *</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => {
                      setType(v as MaintenanceType)
                      setErrors({})
                    }}
                  >
                    <SelectTrigger id="mnt-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional Block 1: Filter Media Replacement */}
              {type === 'Troca de Mídia Filtrante' && (
                <div className="rounded-xl border border-purple-600 bg-purple-100/80 p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                    Especificação de Elementos Filtrantes
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="filter-element"
                        className={errors.filterElement ? 'text-red-700' : ''}
                      >
                        Elemento Filtrante Substituído *
                      </Label>
                      <Select
                        value={filterElement}
                        onValueChange={(v) => {
                          setFilterElement(v as FilterMediaElement)
                          setErrors((prev) => ({ ...prev, filterElement: false }))
                        }}
                      >
                        <SelectTrigger
                          id="filter-element"
                          className={
                            errors.filterElement ? 'border-red-500 ring-1 ring-red-500' : ''
                          }
                        >
                          <SelectValue placeholder="Selecione o elemento..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FILTER_ELEMENTS.map((el) => (
                            <SelectItem key={el} value={el}>
                              {el}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="filter-volume"
                        className={errors.filterVolume ? 'text-red-700' : ''}
                      >
                        Quantidade / Volume Instalado *
                      </Label>
                      <Input
                        id="filter-volume"
                        placeholder="Ex.: 50 kg ou 40 litros"
                        value={filterVolume}
                        onChange={(e) => {
                          setFilterVolume(e.target.value)
                          setErrors((prev) => ({ ...prev, filterVolume: false }))
                        }}
                        className={errors.filterVolume ? 'border-red-500 ring-1 ring-red-500' : ''}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Block 2: Sensor Calibration / Replacement */}
              {(type === 'Calibração de Sensores' ||
                type === 'Substituição de Sensores Eletrônicos') && (
                <div className="rounded-xl border border-purple-600 bg-purple-100/80 p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                    Dados de Calibração / Substituição de Sensor Eletrônico
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="sensor-type">Sensor Atendido *</Label>
                      <Select
                        value={sensorType}
                        onValueChange={(v) => {
                          setSensorType(v as SensorType)
                          setErrors((prev) => ({ ...prev, sensorType: false }))
                        }}
                      >
                        <SelectTrigger id="sensor-type">
                          <SelectValue placeholder="Selecione o sensor" />
                        </SelectTrigger>
                        <SelectContent>
                          {SENSOR_TYPES.map((s) => (
                            <SelectItem key={s} value={s}>
                              Sensor de {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="cal-datetime"
                        className={errors.calibrationDateTime ? 'text-red-700' : ''}
                      >
                        Data e Hora da Calibração *
                      </Label>
                      <Input
                        id="cal-datetime"
                        type="datetime-local"
                        value={calibrationDateTime}
                        onChange={(e) => {
                          setCalibrationDateTime(e.target.value)
                          setErrors((prev) => ({ ...prev, calibrationDateTime: false }))
                        }}
                        className={
                          errors.calibrationDateTime ? 'border-red-500 ring-1 ring-red-500' : ''
                        }
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label
                        htmlFor="buffer-solution"
                        className={errors.bufferSolution ? 'text-red-700' : ''}
                      >
                        Padrão de Solução Utilizado *
                      </Label>
                      <Input
                        id="buffer-solution"
                        placeholder="Ex.: Solução Tampão pH 4,0 / 7,0 ou Formazina 10 UNT"
                        value={bufferSolution}
                        onChange={(e) => {
                          setBufferSolution(e.target.value)
                          setErrors((prev) => ({ ...prev, bufferSolution: false }))
                        }}
                        className={
                          errors.bufferSolution ? 'border-red-500 ring-1 ring-red-500' : ''
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="reading-before"
                        className={errors.readingBefore ? 'text-red-700' : ''}
                      >
                        Leitura Pré-Calibração *
                      </Label>
                      <Input
                        id="reading-before"
                        placeholder="Ex.: 6.1 pH / 5.4 UNT"
                        value={readingBefore}
                        onChange={(e) => {
                          setReadingBefore(e.target.value)
                          setErrors((prev) => ({ ...prev, readingBefore: false }))
                        }}
                        className={errors.readingBefore ? 'border-red-500 ring-1 ring-red-500' : ''}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="reading-after"
                        className={errors.readingAfter ? 'text-red-700' : ''}
                      >
                        Leitura Pós-Calibração *
                      </Label>
                      <Input
                        id="reading-after"
                        placeholder="Ex.: 7.0 pH / 1.8 UNT"
                        value={readingAfter}
                        onChange={(e) => {
                          setReadingAfter(e.target.value)
                          setErrors((prev) => ({ ...prev, readingAfter: false }))
                        }}
                        className={errors.readingAfter ? 'border-red-500 ring-1 ring-red-500' : ''}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mandatory Photo Attachment (.jpg/.png <= 5 MB) */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="mnt-photo"
                  className={errors.photo ? 'text-red-700' : ''}
                >
                  Evidência Fotográfica Obrigatória (.jpg ou .png até 5 MB) *
                </Label>
                <label
                  htmlFor="mnt-photo"
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${
                    errors.photo
                      ? 'border-red-500 bg-red-50/70 text-red-700'
                      : 'border-purple-600 bg-purple-100/60 hover:bg-purple-200/70 text-blue-900'
                  }`}
                >
                  {photoDataUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={photoDataUrl}
                        alt="Pré-visualização da evidência fotográfica"
                        className="max-h-36 rounded-lg border border-purple-600 object-cover"
                      />
                      <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        <Camera className="h-3.5 w-3.5" />
                        {photoName} (clique para trocar)
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mb-1.5 text-blue-500" />
                      <span className="text-sm font-medium">
                        Clique para anexar foto comprovatória do serviço
                      </span>
                      <span className="text-xs text-purple-900 mt-0.5">
                        Mídia filtrante renovada ou sensor calibrado · JPG/PNG · máx. 5 MB
                      </span>
                    </>
                  )}
                  <input
                    id="mnt-photo"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                </label>
                {photoErrorDetail && (
                  <p className="text-xs font-medium text-red-700">{photoErrorDetail}</p>
                )}
              </div>

              {/* Automatic Georeferencing Box */}
              <div className="rounded-lg border border-purple-600 bg-purple-100/70 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <LocateFixed className="h-4 w-4 text-blue-500 shrink-0" />
                    Georreferenciamento Vinculado ({selectedWell?.code ?? '—'})
                  </p>
                  <p className="text-purple-900 truncate">
                    Lat: <strong>{gpsCoords.latitude.toFixed(5)}</strong> · Lng:{' '}
                    <strong>{gpsCoords.longitude.toFixed(5)}</strong> · {gpsStatus}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleCaptureGps}>
                  Atualizar GPS
                </Button>
              </div>

              {/* Observations */}
              <div className="space-y-1.5">
                <Label htmlFor="mnt-notes">Observações Técnicas de Campo</Label>
                <Textarea
                  id="mnt-notes"
                  placeholder="Descreva o estado anterior do equipamento, peças utilizadas ou recomendações para a próxima inspeção..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" size="lg">
                  Salvar Registro
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Well Cycle Status + History Sidebar */}
        <div className="lg:col-span-2 space-y-6">
          {selectedWell && (
            <Card className="bg-purple-100 border-purple-600">
              <CardHeader className="pb-3">
                <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold">
                  Ciclo Preventivo do Poço Selecionado
                </span>
                <CardTitle className="text-xl">{selectedWell.name}</CardTitle>
                <CardDescription>{selectedWell.sector}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-purple-500 bg-white p-3">
                  <span className="text-purple-900 block">Última Manutenção</span>
                  <strong className="text-base text-blue-900 mt-0.5 block tabular-nums">
                    {formatDateBR(selectedWell.lastMaintenanceDate)}
                  </strong>
                </div>
                <div className="rounded-lg border border-purple-500 bg-white p-3">
                  <span className="text-purple-900 block">Próximo Ciclo (90d)</span>
                  <strong className="text-base text-blue-500 mt-0.5 block tabular-nums">
                    {formatDateBR(selectedWell.nextMaintenanceDate)}
                  </strong>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Manutenções ({maintenances.length})</CardTitle>
              <CardDescription>
                Intervenções registradas nos poços do Assentamento Santa Luzia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[540px] overflow-y-auto">
              {maintenances.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-purple-500 bg-purple-100/70 p-3.5 space-y-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="default">{m.type}</Badge>
                    <span className="text-purple-900">
                      {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="font-serif text-sm font-bold text-blue-900">{m.wellName}</p>
                  {m.filterElement && (
                    <p className="text-blue-900">
                      <strong>Elemento:</strong> {m.filterElement} ({m.filterVolume})
                    </p>
                  )}
                  {m.sensorType && (
                    <p className="text-blue-900">
                      <strong>Sensor {m.sensorType}:</strong> {m.readingBefore} → {m.readingAfter} (
                      {m.bufferSolution})
                    </p>
                  )}
                  <p className="text-purple-900">{m.notes}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-purple-500 text-[11px] text-purple-900">
                    <span>Foto: {m.photoName}</span>
                    <span>
                      GPS: {m.gpsCoords.latitude.toFixed(4)}, {m.gpsCoords.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
