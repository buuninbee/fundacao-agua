import { useState, type FormEvent } from 'react'
import { Award, Calendar, CheckCircle2, MapPin, Plus, QrCode, Users } from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import { formatDateBR } from '@/lib/waterRules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function WorkshopsPage() {
  const { workshops, createWorkshop, toggleWorkshopCheckIn } = useMipc()

  const [selectedId, setSelectedId] = useState(workshops[0]?.id ?? '')
  const [modalOpen, setModalOpen] = useState(false)
  const [qrInput, setQrInput] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  // New workshop form
  const [title, setTitle] = useState('')
  const [agenda, setAgenda] = useState('')
  const [facilitator, setFacilitator] = useState('Mariana Souza · Fundação Água Limpa')
  const [dateTime, setDateTime] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return `${d.toISOString().slice(0, 10)}T14:00`
  })
  const [location, setLocation] = useState('Centro Comunitário Santa Luzia — Quadra 01')
  const [maxSeats, setMaxSeats] = useState('25')

  const selected = workshops.find((w) => w.id === selectedId) ?? workshops[0]

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !agenda.trim() || !location.trim()) return

    const created = createWorkshop({
      title: title.trim(),
      agenda: agenda.trim(),
      facilitator: facilitator.trim() || 'Fundação Água Limpa',
      dateTime,
      location: location.trim(),
      maxSeats: Math.max(1, Number(maxSeats) || 20),
    })

    setSelectedId(created.id)
    setFeedback(
      `Workshop "${created.title}" publicado e divulgado na central dos moradores.`,
    )
    setTitle('')
    setAgenda('')
    setModalOpen(false)
  }

  function handleQrCheckIn(e: FormEvent) {
    e.preventDefault()
    if (!selected || !qrInput.trim()) return
    const query = qrInput.trim().toLowerCase()
    const match = selected.participants.find(
      (p) =>
        p.status === 'confirmed' &&
        (p.name.toLowerCase().includes(query) ||
          `mipc-qr-${p.name.split(' ')[0].toLowerCase()}` === query),
    )
    if (!match) {
      setFeedback(`Nenhum inscrito confirmado encontrado para "${qrInput}".`)
      return
    }
    if (!match.checkedIn) toggleWorkshopCheckIn(selected.id, match.name)
    setFeedback(
      `Presença confirmada para ${match.name} — selo "Família Capacitada em Saneamento" emitido.`,
    )
    setQrInput('')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Mobilização Comunitária · HU-MIPC-09
          </span>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
            Workshops de Educação Sanitária
          </h1>
          <p className="mt-0.5 text-sm text-purple-900">
            Publique oficinas, acompanhe vagas e fila de espera e faça o check-in dos moradores.
          </p>
        </div>

        <Button type="button" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Workshop
        </Button>
      </div>

      {feedback && (
        <FeedbackBanner variant="success" message={feedback} onDismiss={() => setFeedback(null)} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Workshops List */}
        <div className="lg:col-span-2 space-y-3">
          {workshops.map((w) => {
            const confirmed = w.participants.filter((p) => p.status === 'confirmed').length
            const waitlist = w.participants.filter((p) => p.status === 'waitlist').length
            const remaining = Math.max(0, w.maxSeats - confirmed)
            const isSelected = w.id === selected?.id

            return (
              <Card
                key={w.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(w.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedId(w.id)
                  }
                }}
                className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-blue-300'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={remaining > 0 ? 'excellent' : 'attention'}>
                      {remaining > 0 ? `${remaining} vaga(s) restante(s)` : 'Lotado · Lista de Espera'}
                    </Badge>
                    <span className="text-xs text-purple-900 tabular-nums">
                      {confirmed}/{w.maxSeats}
                    </span>
                  </div>
                  <CardTitle className="mt-1 text-base">{w.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs text-purple-900">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    {formatDateBR(w.dateTime.slice(0, 10))} às {w.dateTime.slice(11, 16)}
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    {w.location}
                  </p>
                  {waitlist > 0 && (
                    <p className="font-semibold text-amber-800">{waitlist} pessoa(s) na fila de espera</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Selected Workshop Attendance & Check-in */}
        {selected && (() => {
          const confirmedList = selected.participants.filter((p) => p.status === 'confirmed')
          const waitlist = selected.participants.filter((p) => p.status === 'waitlist')
          const checkedInCount = confirmedList.filter((p) => p.checkedIn).length

          return (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>{selected.title}</CardTitle>
                <CardDescription>
                  {selected.agenda} · Facilitador(a): <strong>{selected.facilitator}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* QR / Quick name check-in */}
                <form
                  onSubmit={handleQrCheckIn}
                  className="rounded-xl border border-purple-600 bg-purple-100/70 p-3.5 flex flex-col sm:flex-row gap-2"
                >
                  <div className="relative flex-1 min-w-0">
                    <QrCode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
                    <Input
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="Código QR do morador (ex.: MIPC-QR-JOAO) ou nome..."
                      className="pl-9"
                      aria-label="Validar presença por QR Code ou nome"
                    />
                  </div>
                  <Button type="submit" variant="outline" className="shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                    Validar Check-in
                  </Button>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-purple-900">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-blue-900">
                    <Users className="h-4 w-4 text-blue-500" />
                    Confirmados ({confirmedList.length}/{selected.maxSeats}) · Presentes ({checkedInCount})
                  </span>
                  {waitlist.length > 0 && (
                    <Badge variant="attention">Lista de Espera: {waitlist.length}</Badge>
                  )}
                </div>

                {/* Participant rows */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {confirmedList.length === 0 ? (
                    <p className="text-sm text-purple-900 py-4 text-center">
                      Nenhum morador inscrito ainda.
                    </p>
                  ) : (
                    confirmedList.slice(0, 12).map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between gap-3 rounded-lg border border-purple-500 bg-white px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <span className="font-semibold text-blue-900 block truncate">{p.name}</span>
                          {p.checkedIn && (
                            <Badge variant="excellent" className="w-fit">
                              <Award className="h-3 w-3" />
                              Família Capacitada em Saneamento
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={p.checkedIn ? 'outline' : 'secondary'}
                          className="shrink-0"
                          onClick={() => toggleWorkshopCheckIn(selected.id, p.name)}
                        >
                          {p.checkedIn ? 'Desfazer' : 'Registrar presença'}
                        </Button>
                      </div>
                    ))
                  )}
                  {confirmedList.length > 12 && (
                    <p className="text-xs text-purple-900 text-center pt-1">
                      + {confirmedList.length - 12} inscrito(s) confirmado(s) na lista completa.
                    </p>
                  )}
                </div>

                {waitlist.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                    <p className="font-semibold mb-1">Fila de Espera (promoção automática ao desistir):</p>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      {waitlist.map((w) => (
                        <li key={w.name}>{w.name}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })()}
      </div>

      {/* Create Workshop Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Workshop de Capacitação</DialogTitle>
            <DialogDescription>
              Ao publicar, o convite aparece imediatamente para os moradores confirmarem presença.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wk-title">Tema do Workshop *</Label>
              <Input
                id="wk-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Oficina de Higienização de Reservatórios"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wk-agenda">Pauta Resumida *</Label>
              <Textarea
                id="wk-agenda"
                required
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="Descreva o que será ensinado às famílias..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="wk-fac">Palestrante / ONG Facilitadora *</Label>
                <Input
                  id="wk-fac"
                  required
                  value={facilitator}
                  onChange={(e) => setFacilitator(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="wk-date">Data e Hora *</Label>
                <Input
                  id="wk-date"
                  type="datetime-local"
                  required
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 min-w-0 sm:col-span-2">
                <Label htmlFor="wk-loc">Local no Assentamento *</Label>
                <Input
                  id="wk-loc"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="wk-seats">Máx. de Vagas *</Label>
                <Input
                  id="wk-seats"
                  type="number"
                  min={1}
                  required
                  value={maxSeats}
                  onChange={(e) => setMaxSeats(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Publicar Workshop</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
