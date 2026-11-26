import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertOctagon,
  Camera,
  CheckCircle2,
  LocateFixed,
  Mic,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import {
  formatDateBR,
  MAX_PHOTO_SIZE_BYTES,
  validateEmergencyInput,
} from '@/lib/waterRules'
import type { EmergencyCategory } from '@/types/mipc'
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

const EMERGENCY_CATEGORIES: EmergencyCategory[] = [
  'Desabastecimento Total',
  'Vazamento Grave / Rompimento de Adutora',
  'Contaminação Visível / Riscos à Saúde',
  'Vandalismo ou Dano Físico Severo',
]

export function EmergenciesPage() {
  const { wells, emergencies, addEmergencyReport, resolveEmergency } = useMipc()

  const [wellId, setWellId] = useState(wells[3]?.id ?? wells[0]?.id ?? '')
  const [category, setCategory] = useState<EmergencyCategory | ''>('')
  const [affectedFamilies, setAffectedFamilies] = useState('450')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<{ name: string; dataUrl: string }[]>([])
  const [photoError, setPhotoError] = useState('')
  const [audioLabel, setAudioLabel] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const selectedWell = wells.find((w) => w.id === wellId)
  const [gpsCoords, setGpsCoords] = useState({
    latitude: selectedWell?.latitude ?? -15.7962,
    longitude: selectedWell?.longitude ?? -47.9985,
  })
  const [gpsStatus, setGpsStatus] = useState('Sincronizado com o poço')

  const [errors, setErrors] = useState<{
    wellId?: boolean
    category?: boolean
    evidence?: boolean
    banner?: string
  }>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function handleAddPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setPhotoError('')
    if (!file) return

    if (photos.length >= 3) {
      setPhotoError('Limite máximo de 3 fotos por urgência hídrica.')
      return
    }
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setPhotoError('Envie apenas imagens .jpg ou .png.')
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError('Cada foto deve ter até 5 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotos((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }])
        setErrors((prev) => ({ ...prev, evidence: false, banner: undefined }))
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleToggleAudio() {
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop()
      setIsRecording(false)
      return
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const rec = new MediaRecorder(stream)
        recorderRef.current = rec
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          setAudioLabel('Relato de áudio gravado em campo (<= 60s)')
          setErrors((prev) => ({ ...prev, evidence: false, banner: undefined }))
        }
        rec.start()
        setIsRecording(true)
        window.setTimeout(() => {
          if (rec.state === 'recording') {
            rec.stop()
            setIsRecording(false)
          }
        }, 60_000)
        return
      } catch {
        // Fallback when microphone permission is unavailable
      }
    }
    setAudioLabel('Relato de áudio anexado (simulado · 24s)')
    setErrors((prev) => ({ ...prev, evidence: false, banner: undefined }))
  }

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
          if (selectedWell) {
            setGpsCoords({ latitude: selectedWell.latitude, longitude: selectedWell.longitude })
          }
          setGpsStatus('Sincronizado com o poço')
        },
      )
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSuccessMessage(null)

    const nextErrors = validateEmergencyInput({
      wellId,
      category,
      description,
      photosCount: photos.length,
      hasAudio: Boolean(audioLabel),
    })
    if (nextErrors.banner) {
      setErrors(nextErrors)
      return
    }

    if (!selectedWell || !category) return

    const created = addEmergencyReport({
      wellId: selectedWell.id,
      wellName: selectedWell.name,
      category,
      description: description.trim(),
      affectedFamilies: Math.max(1, Number(affectedFamilies) || selectedWell.affectedFamilies),
      photos,
      audioLabel: audioLabel || undefined,
      gpsCoords,
    })

    setSuccessMessage(
      `Protocolo ${created.protocolCode} emitido (SLA 2h). Equipe notificada via Push/E-mail/SMS e ${selectedWell.name} marcado como [Interditado / Emergência].`,
    )
    setErrors({})
    setCategory('')
    setDescription('')
    setPhotos([])
    setAudioLabel('')
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-red-700">
          Prioridade Máxima · SLA de Resposta até 2h
        </span>
        <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Reporte de Urgências Hídricas Territoriais
        </h1>
        <p className="mt-0.5 text-sm text-purple-900">
          Acione imediatamente a equipe de campo da ONG e sinalize o poço como interditado para os
          moradores.
        </p>
      </div>

      {successMessage && (
        <FeedbackBanner
          variant="success"
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      {errors.banner && <FeedbackBanner variant="error" message={errors.banner} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <AlertOctagon className="h-5 w-5 text-red-600" />
                Abrir Chamado de Emergência
              </CardTitle>
              <Badge variant="critical">Prioridade: Máxima / SLA 2h</Badge>
            </div>
            <CardDescription>
              Ao confirmar, o poço exibe o selo [Interditado / Emergência] para todos os moradores.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="urg-well" className={errors.wellId ? 'text-red-700' : ''}>
                    Poço Afetado *
                  </Label>
                  <Select
                    value={wellId}
                    onValueChange={(v) => {
                      setWellId(v)
                      const found = wells.find((w) => w.id === v)
                      if (found) {
                        setGpsCoords({ latitude: found.latitude, longitude: found.longitude })
                        setAffectedFamilies(String(found.affectedFamilies))
                      }
                      setErrors((prev) => ({ ...prev, wellId: false }))
                    }}
                  >
                    <SelectTrigger
                      id="urg-well"
                      className={errors.wellId ? 'border-red-500 ring-1 ring-red-500' : ''}
                    >
                      <SelectValue placeholder="Selecione o poço..." />
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
                  <Label htmlFor="urg-cat" className={errors.category ? 'text-red-700' : ''}>
                    Categoria da Emergência *
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(v) => {
                      setCategory(v as EmergencyCategory)
                      setErrors((prev) => ({ ...prev, category: false }))
                    }}
                  >
                    <SelectTrigger
                      id="urg-cat"
                      className={errors.category ? 'border-red-500 ring-1 ring-red-500' : ''}
                    >
                      <SelectValue placeholder="Selecione a categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {EMERGENCY_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="urg-families">Famílias Afetadas (estimativa)</Label>
                  <Input
                    id="urg-families"
                    type="number"
                    min={1}
                    value={affectedFamilies}
                    onChange={(e) => setAffectedFamilies(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label>GPS da Ocorrência</Label>
                  <div className="flex items-center justify-between gap-2 h-10 rounded-md border border-purple-600 bg-purple-100/70 px-3 text-xs">
                    <span className="truncate text-purple-900">
                      <LocateFixed className="inline h-3.5 w-3.5 text-blue-500 mr-1" />
                      {gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)} · {gpsStatus}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={handleCaptureGps}
                    >
                      Atualizar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="urg-desc" className={errors.evidence ? 'text-red-700' : ''}>
                  Descrição Detalhada do Local / Problema
                </Label>
                <Textarea
                  id="urg-desc"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    setErrors((prev) => ({ ...prev, evidence: false }))
                  }}
                  placeholder="Informe ponto de referência, extensão do vazamento ou indícios de contaminação..."
                  className={errors.evidence ? 'border-red-500 ring-1 ring-red-500' : ''}
                />
              </div>

              {/* Multi-photo (max 3) + 60s Audio evidence */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  htmlFor="urg-photo"
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3.5 text-center transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 ${
                    errors.evidence
                      ? 'border-red-500 bg-red-50/70 text-red-700'
                      : 'border-purple-600 bg-purple-100/60 hover:bg-purple-200/70 text-blue-900'
                  }`}
                >
                  <Upload className="h-5 w-5 mb-1 text-blue-500" />
                  <span className="text-xs font-semibold">Anexar fotos ({photos.length}/3)</span>
                  <span className="text-[11px] text-purple-900">JPG/PNG até 5 MB</span>
                  <input
                    id="urg-photo"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleAddPhoto}
                    className="sr-only"
                  />
                </label>

                <div
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3.5 text-center gap-1.5 ${
                    errors.evidence
                      ? 'border-red-500 bg-red-50/70'
                      : 'border-purple-600 bg-purple-100/60'
                  }`}
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={isRecording ? 'destructive' : 'outline'}
                    onClick={handleToggleAudio}
                  >
                    {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {isRecording ? 'Parar gravação' : 'Gravar áudio (até 60s)'}
                  </Button>
                  <span className="text-[11px] text-purple-900 truncate max-w-full">
                    {audioLabel || 'Opcional para relato rápido em campo'}
                  </span>
                </div>
              </div>

              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-purple-600 bg-purple-100 px-2.5 py-1.5 text-xs"
                    >
                      <Camera className="h-3.5 w-3.5 text-blue-500" />
                      <span className="max-w-[140px] truncate">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remover ${p.name}`}
                        className="text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photoError && <p className="text-xs font-medium text-red-700">{photoError}</p>}

              <div className="flex justify-end pt-1">
                <Button type="submit" size="lg">
                  Submeter Urgência Hídrica
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Active & Recent Emergencies */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Protocolos de Urgência ({emergencies.length})</CardTitle>
            <CardDescription>
              Alertas disparados via Push, E-mail e SMS para o plantão da ONG.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {emergencies.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-purple-600 bg-purple-100/70 p-3.5 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={item.status === 'Resolvida' ? 'excellent' : 'critical'}>
                    {item.protocolCode} · {item.status}
                  </Badge>
                  <span className="text-purple-900 tabular-nums">
                    {formatDateBR(item.createdAt)}
                  </span>
                </div>
                <p className="font-serif text-sm font-bold text-blue-900">{item.wellName}</p>
                <p className="font-medium text-blue-900">{item.category}</p>
                {item.description && <p className="text-purple-900">{item.description}</p>}
                <p className="text-[11px] text-purple-900">
                  ~{item.affectedFamilies} famílias · SLA {item.slaHours}h · Canais:{' '}
                  {item.notifiedChannels.join(', ')}
                </p>
                {item.status === 'Em Atendimento' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    onClick={() => resolveEmergency(item.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Encerrar emergência e liberar poço
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
