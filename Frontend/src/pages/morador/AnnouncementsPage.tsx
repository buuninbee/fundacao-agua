import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  MapPin,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import { formatDateBR } from '@/lib/waterRules'
import type { Announcement, AnnouncementPriority } from '@/types/mipc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const RESIDENT_NAME = 'João da Silva'

function priorityStyle(priority: AnnouncementPriority) {
  if (priority === 'Crítico') {
    return { badge: 'critical' as const, label: 'Alerta Urgente', Icon: AlertTriangle }
  }
  if (priority === 'Agendado') {
    return { badge: 'attention' as const, label: 'Manutenção Agendada', Icon: CalendarClock }
  }
  return { badge: 'excellent' as const, label: 'Dica de Saúde', Icon: HeartPulse }
}

export function AnnouncementsPage() {
  const { announcements, workshops, markAnnouncementRead, rsvpWorkshop } = useMipc()
  const [selected, setSelected] = useState<Announcement | null>(null)
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const operationalAlerts = announcements.filter((a) => a.category === 'Alerta Operacional')
  const healthGuides = announcements.filter((a) => a.category === 'Educação Sanitária')

  function openAnnouncement(item: Announcement) {
    setSelected(item)
    if (!item.read) markAnnouncementRead(item.id)
  }

  function renderList(items: Announcement[]) {
    return (
      <div className="space-y-3">
        {items.map((item) => {
          const { badge, label, Icon } = priorityStyle(item.priority)
          return (
            <Card
              key={item.id}
              className={`transition-colors ${!item.read ? 'border-blue-400 bg-white' : 'bg-purple-100/50'}`}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={badge}>
                      <Icon className="h-3 w-3" />
                      {label}
                    </Badge>
                    {!item.read && <Badge variant="default">Novo</Badge>}
                  </div>
                  <span className="text-xs text-purple-900 tabular-nums">
                    {formatDateBR(item.publishedAt)}
                  </span>
                </div>
                <CardTitle className="mt-1 text-lg">{item.title}</CardTitle>
                {item.scheduleWindow && (
                  <p className="text-xs font-semibold text-blue-500">{item.scheduleWindow}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-purple-900">{item.summary}</p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-purple-900">
                    {item.wellName ?? 'Cartilha comunitária · Fundação Água Limpa'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openAnnouncement(item)}
                  >
                    Ler comunicado
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Central de Comunicados
          </span>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
            Avisos de Manutenção e Educação Sanitária
          </h1>
          <p className="mt-0.5 text-sm text-purple-900">
            Acompanhe paradas programadas com antecedência e guias práticos para proteger sua
            família.
          </p>
        </div>

        <Badge variant={isOnline ? 'excellent' : 'offline'} className="shrink-0">
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? 'Sincronizado (salvo para consulta offline)' : 'Modo offline — exibindo avisos salvos'}
        </Badge>
      </div>

      {rsvpMessage && (
        <FeedbackBanner
          variant="success"
          message={rsvpMessage}
          onDismiss={() => setRsvpMessage(null)}
        />
      )}

      <Tabs defaultValue="alertas">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="alertas">
            <Bell className="h-4 w-4" />
            Alertas Operacionais ({operationalAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="educacao">
            <BookOpen className="h-4 w-4" />
            Educação Sanitária ({healthGuides.length})
          </TabsTrigger>
          <TabsTrigger value="eventos">
            <Users className="h-4 w-4" />
            Eventos e Capacitações ({workshops.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alertas">{renderList(operationalAlerts)}</TabsContent>
        <TabsContent value="educacao">{renderList(healthGuides)}</TabsContent>
        <TabsContent value="eventos" className="space-y-3">
          {workshops.map((w) => {
            const confirmed = w.participants.filter((p) => p.status === 'confirmed').length
            const remaining = Math.max(0, w.maxSeats - confirmed)
            const mine = w.participants.find((p) => p.name === RESIDENT_NAME)
            const waitPos =
              mine?.status === 'waitlist'
                ? w.participants
                    .filter((p) => p.status === 'waitlist')
                    .findIndex((p) => p.name === RESIDENT_NAME) + 1
                : 0

            return (
              <Card key={w.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={remaining > 0 ? 'excellent' : 'attention'}>
                        {remaining > 0 ? `${remaining} vaga(s) restante(s)` : 'Vagas esgotadas'}
                      </Badge>
                      {mine?.checkedIn && (
                        <Badge variant="excellent">
                          <Award className="h-3 w-3" />
                          Família Capacitada em Saneamento
                        </Badge>
                      )}
                      {mine?.status === 'confirmed' && !mine.checkedIn && (
                        <Badge variant="default">Presença Confirmada · QR: MIPC-QR-JOAO</Badge>
                      )}
                      {mine?.status === 'waitlist' && (
                        <Badge variant="orange">Lista de Espera (#{waitPos})</Badge>
                      )}
                    </div>
                    <span className="text-xs text-purple-900 tabular-nums">
                      {confirmed}/{w.maxSeats} inscritos
                    </span>
                  </div>
                  <CardTitle className="mt-1 text-lg">{w.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-purple-900">{w.agenda}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-purple-900">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-blue-500" />
                        {formatDateBR(w.dateTime.slice(0, 10))} às {w.dateTime.slice(11, 16)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-blue-500" />
                        {w.location}
                      </span>
                    </div>
                    {mine ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          rsvpWorkshop(w.id, RESIDENT_NAME, 'cancel')
                          setRsvpMessage(`Você saiu da lista do workshop "${w.title}".`)
                        }}
                      >
                        Desistir da Vaga
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant={remaining > 0 ? 'default' : 'secondary'}
                        onClick={() => {
                          const outcome = rsvpWorkshop(w.id, RESIDENT_NAME, 'join')
                          setRsvpMessage(
                            outcome === 'confirmed'
                              ? 'Sua inscrição foi confirmada com sucesso'
                              : `Vagas originais esgotadas — você entrou na Lista de Espera de "${w.title}".`,
                          )
                        }}
                      >
                        {remaining > 0 ? 'Confirmar Presença' : 'Entrar na Lista de Espera'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (() => {
            const { badge, label, Icon } = priorityStyle(selected.priority)
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={badge}>
                      <Icon className="h-3 w-3" />
                      {label}
                    </Badge>
                    <span className="text-xs text-purple-900 tabular-nums">
                      Publicado em {formatDateBR(selected.publishedAt)}
                    </span>
                  </div>
                  <DialogTitle>{selected.title}</DialogTitle>
                  {selected.scheduleWindow && (
                    <DialogDescription className="font-semibold text-blue-500">
                      {selected.scheduleWindow}
                    </DialogDescription>
                  )}
                </DialogHeader>

                <div className="space-y-4 text-sm text-blue-900">
                  <p>{selected.body}</p>
                  {selected.steps && selected.steps.length > 0 && (
                    <div className="rounded-xl border border-purple-600 bg-purple-100/70 p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                        Orientações passo a passo
                      </p>
                      <ol className="space-y-2 list-decimal pl-5 text-sm text-blue-900">
                        {selected.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" onClick={() => setSelected(null)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Entendi
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
