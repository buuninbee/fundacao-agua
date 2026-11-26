import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import {
  Camera,
  ClipboardList,
  LocateFixed,
  MessageSquarePlus,
  Trash2,
  Upload,
} from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import {
  formatDateBR,
  MAX_PHOTO_SIZE_BYTES,
  validateOmbudsmanInput,
} from '@/lib/waterRules'
import type { OmbudsmanCategory, OmbudsmanStatus } from '@/types/mipc'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const CATEGORIES: OmbudsmanCategory[] = [
  'Alteração de Odor',
  'Alteração de Coloração / Turbidez',
  'Vazamento ou Dano Físico',
  'Sabor Estranho na Água',
  'Interrupção Inesperada no Fluxo',
]

const STATUS_FLOW: OmbudsmanStatus[] = [
  'Registrado',
  'Em Análise Técnica',
  'Visita Agendada',
  'Concluído',
]

function statusBadgeVariant(status: OmbudsmanStatus) {
  if (status === 'Concluído') return 'excellent' as const
  if (status === 'Visita Agendada') return 'orange' as const
  if (status === 'Em Análise Técnica') return 'attention' as const
  return 'default' as const
}

export function OmbudsmanPage() {
  const [searchParams] = useSearchParams()
  const { wells, tickets, addOmbudsmanTicket } = useMipc()

  const [activeTab, setActiveTab] = useState<'nova' | 'demandas'>('nova')
  const [wellId, setWellId] = useState(() => searchParams.get('wellId') ?? '')
  const [category, setCategory] = useState<OmbudsmanCategory | ''>('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<{ name: string; dataUrl: string }[]>([])
  const [photoError, setPhotoError] = useState('')
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [gpsLabel, setGpsLabel] = useState('Opcional — ajuda a localizar vazamentos')

  const [errors, setErrors] = useState<{
    wellId?: boolean
    category?: boolean
    description?: boolean
    banner?: string
  }>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function handleAddPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setPhotoError('')
    if (!file) return

    if (photos.length >= 2) {
      setPhotoError('É permitido anexar no máximo 2 fotos por ocorrência.')
      return
    }
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setPhotoError('Envie apenas imagens .jpg ou .png.')
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError('Cada foto deve ter no máximo 5 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotos((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }])
      }
    }
    reader.readAsDataURL(file)
  }

  function handleCaptureGps() {
    const well = wells.find((w) => w.id === wellId)
    if (!('geolocation' in navigator)) {
      if (well) {
        setGpsCoords({ latitude: well.latitude, longitude: well.longitude })
        setGpsLabel('Coordenada vinculada ao poço')
      }
      return
    }
    setGpsLabel('Obtendo localização...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
        })
        setGpsLabel('GPS capturado')
      },
      () => {
        if (well) {
          setGpsCoords({ latitude: well.latitude, longitude: well.longitude })
          setGpsLabel('Coordenada vinculada ao poço')
        } else {
          setGpsLabel('GPS indisponível no navegador')
        }
      },
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSuccessMessage(null)

    const nextErrors = validateOmbudsmanInput({ wellId, category, description })
    if (nextErrors.banner) {
      setErrors(nextErrors)
      return
    }

    const well = wells.find((w) => w.id === wellId)
    if (!well || !category) return

    const created = addOmbudsmanTicket({
      wellId: well.id,
      wellName: well.name,
      category,
      description: description.trim(),
      photos,
      gpsCoords: gpsCoords ?? undefined,
    })

    // Exact BDD HU-MIPC-06 Scenario 1 confirmation message + protocol
    setSuccessMessage(
      `Sua reclamação foi registrada com sucesso — Protocolo ${created.protocolCode}`,
    )
    setErrors({})
    setWellId('')
    setCategory('')
    setDescription('')
    setPhotos([])
    setGpsCoords(null)
    setGpsLabel('Opcional — ajuda a localizar vazamentos')
    setActiveTab('demandas')
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Ouvidoria Digital Comunitária
        </span>
        <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Registrar e Acompanhar Ocorrências
        </h1>
        <p className="mt-0.5 text-sm text-purple-900">
          Relate cheiro, cor, sabor, vazamento ou falta de água no poço e acompanhe pelo número de
          protocolo.
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'nova' | 'demandas')}>
        <TabsList>
          <TabsTrigger value="nova">
            <MessageSquarePlus className="h-4 w-4" />
            Nova Reclamação
          </TabsTrigger>
          <TabsTrigger value="demandas">
            <ClipboardList className="h-4 w-4" />
            Minhas Demandas ({tickets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nova">
          <Card>
            <CardHeader>
              <CardTitle>Abrir Protocolo na Ouvidoria</CardTitle>
              <CardDescription>
                Ao enviar, você recebe um protocolo no formato OUV-AAAA-XXXXX para acompanhar o
                atendimento da ONG.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="ouv-well" className={errors.wellId ? 'text-red-700' : ''}>
                      Poço Comunitário *
                    </Label>
                    <Select
                      value={wellId}
                      onValueChange={(v) => {
                        setWellId(v)
                        setErrors((prev) => ({ ...prev, wellId: false, banner: undefined }))
                      }}
                    >
                      <SelectTrigger
                        id="ouv-well"
                        className={errors.wellId ? 'border-red-500 ring-1 ring-red-500' : ''}
                      >
                        <SelectValue placeholder="Selecione o poço afetado..." />
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
                    <Label htmlFor="ouv-category" className={errors.category ? 'text-red-700' : ''}>
                      Tipo de Problema *
                    </Label>
                    <Select
                      value={category}
                      onValueChange={(v) => {
                        setCategory(v as OmbudsmanCategory)
                        setErrors((prev) => ({ ...prev, category: false, banner: undefined }))
                      }}
                    >
                      <SelectTrigger
                        id="ouv-category"
                        className={errors.category ? 'border-red-500 ring-1 ring-red-500' : ''}
                      >
                        <SelectValue placeholder="Escolha a categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="ouv-desc"
                      className={errors.description ? 'text-red-700' : ''}
                    >
                      Descrição do Problema (mínimo 15 caracteres) *
                    </Label>
                    <span className="text-xs text-purple-900 tabular-nums">
                      {description.trim().length}/15+
                    </span>
                  </div>
                  <Textarea
                    id="ouv-desc"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value)
                      setErrors((prev) => ({ ...prev, description: false }))
                    }}
                    placeholder="Conte o que você observou (ex.: água amarelada saindo da torneira desde cedo)..."
                    className={errors.description ? 'border-red-500 ring-1 ring-red-500' : ''}
                  />
                </div>

                {/* Optional photos (max 2, <= 5 MB) */}
                <div className="space-y-2">
                  <Label htmlFor="ouv-photo">Fotos Comprovatórias (opcional · até 2 fotos .jpg/.png de 5 MB)</Label>
                  {photos.length < 2 && (
                    <label
                      htmlFor="ouv-photo"
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-600 bg-purple-100/60 hover:bg-purple-200/70 p-4 text-center text-blue-900 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
                    >
                      <Upload className="h-5 w-5 mb-1 text-blue-500" />
                      <span className="text-sm font-medium">
                        Anexar foto ({photos.length}/2)
                      </span>
                      <input
                        id="ouv-photo"
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleAddPhoto}
                        className="sr-only"
                      />
                    </label>
                  )}

                  {photos.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {photos.map((photo, idx) => (
                        <div
                          key={`${photo.name}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-purple-600 bg-purple-100/60 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={photo.dataUrl}
                              alt={`Evidência ${idx + 1}`}
                              className="h-11 w-11 rounded object-cover border border-purple-500 shrink-0"
                            />
                            <span className="truncate font-medium text-blue-900 flex items-center gap-1">
                              <Camera className="h-3.5 w-3.5 shrink-0" />
                              {photo.name}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remover foto ${photo.name}`}
                            onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                            className="h-8 w-8 shrink-0 text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {photoError && <p className="text-xs font-medium text-red-700">{photoError}</p>}
                </div>

                {/* Optional GPS */}
                <div className="rounded-lg border border-purple-600 bg-purple-100/70 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-semibold text-blue-900 flex items-center gap-1.5">
                      <LocateFixed className="h-4 w-4 text-blue-500 shrink-0" />
                      Localização GPS do Problema
                    </p>
                    <p className="text-purple-900 truncate">
                      {gpsCoords
                        ? `Lat: ${gpsCoords.latitude.toFixed(5)} · Lng: ${gpsCoords.longitude.toFixed(5)} · ${gpsLabel}`
                        : gpsLabel}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={handleCaptureGps}>
                    Capturar GPS
                  </Button>
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" size="lg">
                    Enviar Reclamação
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demandas" className="space-y-3">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-purple-900">
                Você ainda não registrou nenhuma ocorrência na ouvidoria.
              </CardContent>
            </Card>
          ) : (
            tickets.map((t) => {
              const currentIdx = STATUS_FLOW.indexOf(t.status)
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default" className="tabular-nums">
                          {t.protocolCode}
                        </Badge>
                        <Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge>
                      </div>
                      <span className="text-xs text-purple-900 tabular-nums">
                        Registrado em {formatDateBR(t.createdAt)}
                      </span>
                    </div>
                    <CardTitle className="mt-1 text-lg">{t.wellName}</CardTitle>
                    <CardDescription>{t.category}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-sm text-blue-900">{t.description}</p>

                    {/* 4-step ticket lifecycle */}
                    <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      {STATUS_FLOW.map((step, idx) => {
                        const reached = idx <= currentIdx
                        return (
                          <li
                            key={step}
                            className={`rounded-lg border px-2.5 py-2 text-center font-medium ${
                              reached
                                ? 'border-blue-500 bg-blue-50 text-blue-900'
                                : 'border-purple-500 bg-purple-100/60 text-purple-900'
                            }`}
                          >
                            {idx + 1}. {step}
                          </li>
                        )
                      })}
                    </ol>

                    {t.ongNotes && (
                      <div className="rounded-lg border border-purple-500 bg-purple-100/70 p-3 text-xs text-blue-900">
                        <strong>Retorno da equipe técnica:</strong> {t.ongNotes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
