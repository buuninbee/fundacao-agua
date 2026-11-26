import { useState, type FormEvent } from 'react'
import { CircuitBoard, Sliders } from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import {
  formatDateBR,
  formatDecimalBR,
  validateCalibrationInput,
} from '@/lib/waterRules'
import type { HardwareComponentType } from '@/types/mipc'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const HARDWARE_COMPONENTS: HardwareComponentType[] = [
  'Placa Microcontroladora (ESP32 / STM32)',
  'Módulo de Comunicação (LoRaWAN / Cellular / Satellite)',
  'Sensores de Qualidade (pH / Turbidez / Temp.)',
  'Sistema de Alimentação (Bateria LiFePO4 / Solar)',
]

export function CalibrationPage() {
  const { wells, calibrations, hardwareSwaps, addCalibration, addHardwareSwap } = useMipc()

  // Calibration form state
  const [wellId, setWellId] = useState(wells[2]?.id ?? wells[0]?.id ?? '')
  const [sensor, setSensor] = useState<'pH' | 'Turbidez'>('pH')
  const [offset, setOffset] = useState('-0.05')
  const [slopePct, setSlopePct] = useState('98.2')
  const [bufferReference, setBufferReference] = useState('Solução Tampão pH 4,0 / 7,0 / 10,0')
  const [serialNumber, setSerialNumber] = useState('PH-SN-88412')
  const [firmwareVersion, setFirmwareVersion] = useState('v2.4.2-esp32')
  const [calErrors, setCalErrors] = useState<{ offset?: boolean; slope?: boolean; banner?: string }>(
    {},
  )

  // Hardware swap state
  const [hwWellId, setHwWellId] = useState(wells[0]?.id ?? '')
  const [componentType, setComponentType] = useState<HardwareComponentType>(HARDWARE_COMPONENTS[0])
  const [hwSerial, setHwSerial] = useState('')
  const [hwFirmware, setHwFirmware] = useState('v2.4.2-esp32')
  const [hwNotes, setHwNotes] = useState('')

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function handleSaveCalibration(e: FormEvent) {
    e.preventDefault()
    setSuccessMessage(null)

    const parsedOffset = Number(offset.replace(',', '.'))
    const parsedSlope = sensor === 'pH' ? Number(slopePct.replace(',', '.')) : undefined
    const nextErrors = validateCalibrationInput({
      sensor,
      offset: parsedOffset,
      slopePct: parsedSlope,
    })

    if (nextErrors.banner) {
      setCalErrors(nextErrors)
      return
    }

    const well = wells.find((w) => w.id === wellId)
    if (!well) return

    const created = addCalibration({
      wellId: well.id,
      wellName: well.name,
      sensor,
      offset: parsedOffset,
      slopePct: parsedSlope,
      bufferReference: bufferReference.trim() || (sensor === 'pH' ? 'Tampão pH 4/7/10' : 'Formazina 10 UNT'),
      serialNumber: serialNumber.trim() || 'SN-NAO-INFORMADO',
      firmwareVersion: firmwareVersion.trim() || 'v2.4.2-esp32',
      technicianId: 'FISC-014',
    })

    // Exact BDD HU-MIPC-12 Scenario 1 message
    setSuccessMessage(
      `Calibração atualizada com sucesso — ${created.wellName} (${created.sensor}, versão v${created.version}).`,
    )
    setCalErrors({})
  }

  function handleSaveHardwareSwap(e: FormEvent) {
    e.preventDefault()
    setSuccessMessage(null)
    const well = wells.find((w) => w.id === hwWellId)
    if (!well || !hwSerial.trim()) return

    addHardwareSwap({
      wellId: well.id,
      wellName: well.name,
      componentType,
      serialNumber: hwSerial.trim(),
      firmwareVersion: hwFirmware.trim() || 'v2.4.2-esp32',
      notes: hwNotes.trim() || 'Substituição eletrônica validada em campo.',
      technicianId: 'FISC-014',
    })
    setSuccessMessage(`Troca de componente (${componentType}) registrada em ${well.name}.`)
    setHwSerial('')
    setHwNotes('')
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Precisão de Sensores e Eletrônica · HU-MIPC-12
        </span>
        <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Calibração de Sensores e Hardware
        </h1>
        <p className="mt-0.5 text-sm text-purple-900">
          Versione offsets de pH e turbidez dentro dos limites do fabricante e rastreie trocas de
          placas e módulos.
        </p>
      </div>

      {successMessage && (
        <FeedbackBanner
          variant="success"
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      {calErrors.banner && <FeedbackBanner variant="error" message={calErrors.banner} />}

      <Tabs defaultValue="calibracao">
        <TabsList>
          <TabsTrigger value="calibracao">
            <Sliders className="h-4 w-4" />
            Calibração de Sensores ({calibrations.length})
          </TabsTrigger>
          <TabsTrigger value="hardware">
            <CircuitBoard className="h-4 w-4" />
            Troca de Placas e Módulos ({hardwareSwaps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calibracao">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Registrar Coeficientes de Calibração</CardTitle>
                <CardDescription>
                  Faixas toleradas: pH offset de -2,0 a +2,0 e slope de 80% a 105%; Turbidez offset
                  de -1,5 a +1,5 UNT. Técnico: <strong>FISC-014</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveCalibration} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="cal-well">Poço Monitorado *</Label>
                      <Select value={wellId} onValueChange={setWellId}>
                        <SelectTrigger id="cal-well">
                          <SelectValue />
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
                      <Label htmlFor="cal-sensor">Sonda / Sensor *</Label>
                      <Select
                        value={sensor}
                        onValueChange={(v) => {
                          const s = v as 'pH' | 'Turbidez'
                          setSensor(s)
                          setCalErrors({})
                          setBufferReference(
                            s === 'pH' ? 'Solução Tampão pH 4,0 / 7,0 / 10,0' : 'Formazina 10 UNT',
                          )
                          setSerialNumber(s === 'pH' ? 'PH-SN-88412' : 'TURB-SN-55109')
                        }}
                      >
                        <SelectTrigger id="cal-sensor">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pH">Sensor de pH</SelectItem>
                          <SelectItem value="Turbidez">Sensor de Turbidez (UNT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 min-w-0">
                      <Label
                        htmlFor="cal-offset"
                        className={calErrors.offset ? 'text-red-700' : ''}
                      >
                        {sensor === 'pH' ? 'Offset de Zero (pH) *' : 'Offset de Turbidez (UNT) *'}
                      </Label>
                      <Input
                        id="cal-offset"
                        value={offset}
                        onChange={(e) => {
                          setOffset(e.target.value)
                          setCalErrors({})
                        }}
                        placeholder={sensor === 'pH' ? 'Ex.: -0.05' : 'Ex.: 0.20'}
                        className={calErrors.offset ? 'border-red-500 ring-1 ring-red-500' : ''}
                      />
                    </div>

                    {sensor === 'pH' && (
                      <div className="space-y-1.5 min-w-0">
                        <Label
                          htmlFor="cal-slope"
                          className={calErrors.slope ? 'text-red-700' : ''}
                        >
                          Sensibilidade / Slope (80% a 105%) *
                        </Label>
                        <Input
                          id="cal-slope"
                          value={slopePct}
                          onChange={(e) => {
                            setSlopePct(e.target.value)
                            setCalErrors({})
                          }}
                          placeholder="Ex.: 98.2"
                          className={calErrors.slope ? 'border-red-500 ring-1 ring-red-500' : ''}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cal-buffer">Solução Tampão / Padrão Utilizado</Label>
                    <Input
                      id="cal-buffer"
                      value={bufferReference}
                      onChange={(e) => setBufferReference(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="cal-serial">Nº de Série da Sonda *</Label>
                      <Input
                        id="cal-serial"
                        required
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="cal-fw">Versão do Firmware *</Label>
                      <Input
                        id="cal-fw"
                        required
                        value={firmwareVersion}
                        onChange={(e) => setFirmwareVersion(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" size="lg">
                      Salvar Calibração
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Histórico Versionado</CardTitle>
                <CardDescription>Equações vigentes associadas às leituras de cada poço.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {calibrations.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-purple-600 bg-purple-100/70 p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="default">
                        {c.sensor} · v{c.version}
                      </Badge>
                      <span className="text-purple-900 tabular-nums">
                        {formatDateBR(c.createdAt)}
                      </span>
                    </div>
                    <p className="font-serif text-sm font-bold text-blue-900">{c.wellName}</p>
                    <p className="text-blue-900 tabular-nums">
                      <strong>Offset:</strong> {formatDecimalBR(c.offset, 2)}
                      {c.slopePct !== undefined && (
                        <>
                          {' '}
                          · <strong>Slope:</strong> {formatDecimalBR(c.slopePct, 1)}%
                        </>
                      )}
                    </p>
                    <p className="text-purple-900">{c.bufferReference}</p>
                    <p className="text-[11px] text-purple-900 pt-1 border-t border-purple-500">
                      SN: {c.serialNumber} · FW: {c.firmwareVersion} · Téc.: {c.technicianId}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hardware">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Registrar Troca de Placa ou Módulo</CardTitle>
                <CardDescription>
                  Rastreie número de série e firmware de componentes substituídos em campo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveHardwareSwap} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="hw-well">Poço Monitorado *</Label>
                      <Select value={hwWellId} onValueChange={setHwWellId}>
                        <SelectTrigger id="hw-well">
                          <SelectValue />
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
                      <Label htmlFor="hw-comp">Módulo / Placa Substituída *</Label>
                      <Select
                        value={componentType}
                        onValueChange={(v) => setComponentType(v as HardwareComponentType)}
                      >
                        <SelectTrigger id="hw-comp">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HARDWARE_COMPONENTS.map((comp) => (
                            <SelectItem key={comp} value={comp}>
                              {comp}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="hw-sn">Número de Série Instalado *</Label>
                      <Input
                        id="hw-sn"
                        required
                        value={hwSerial}
                        onChange={(e) => setHwSerial(e.target.value)}
                        placeholder="Ex.: ESP32-MIPC-2026-044"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="hw-fw">Versão do Firmware *</Label>
                      <Input
                        id="hw-fw"
                        required
                        value={hwFirmware}
                        onChange={(e) => setHwFirmware(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hw-notes">Observações Técnicas</Label>
                    <Textarea
                      id="hw-notes"
                      value={hwNotes}
                      onChange={(e) => setHwNotes(e.target.value)}
                      placeholder="Motivo da troca, testes de bancada ou estado da placa anterior..."
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" size="lg">
                      Registrar Substituição
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Histórico de Hardware</CardTitle>
                <CardDescription>Peças e placas substituídas nos nós IoT.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {hardwareSwaps.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-purple-600 bg-purple-100/70 p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{h.technicianId}</Badge>
                      <span className="text-purple-900 tabular-nums">
                        {formatDateBR(h.createdAt)}
                      </span>
                    </div>
                    <p className="font-serif text-sm font-bold text-blue-900">{h.wellName}</p>
                    <p className="font-semibold text-blue-900">{h.componentType}</p>
                    <p className="text-purple-900">{h.notes}</p>
                    <p className="text-[11px] text-purple-900 pt-1 border-t border-purple-500">
                      SN: {h.serialNumber} · FW: {h.firmwareVersion}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
