import { useState, type FormEvent } from 'react'
import { History, Shield, UserCheck, UserPlus, UserX } from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import type { PlatformRole } from '@/types/mipc'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const PLATFORM_ROLES: { role: PlatformRole; scope: string }[] = [
  { role: 'Administrador TI', scope: 'Configurações globais, RBAC, sessões e trilha de auditoria.' },
  { role: 'Fiscal / Agente de Campo', scope: 'Monitoramento IoT, inspeções, manutenção e boletins.' },
  { role: 'Analista Sanitário', scope: 'Validação de dados, relatórios técnicos e laudos.' },
  { role: 'Liderança Comunitária', scope: 'Indicadores consolidados, urgências e workshops.' },
  { role: 'Morador', scope: 'Consulta simplificada da água, comunicados e ouvidoria.' },
]

export function AccessControlPage() {
  const { users, auditLogs, addPlatformUser, updateUserRole, toggleUserStatus } = useMipc()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<PlatformRole>('Fiscal / Agente de Campo')
  const [feedback, setFeedback] = useState<string | null>(null)

  function handleCreateUser(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return

    const created = addPlatformUser({ name, email, role })
    setFeedback(
      `Usuário ${created.name} cadastrado com perfil "${created.role}". E-mail de ativação e definição de senha enviado para ${created.email}.`,
    )
    setName('')
    setEmail('')
    setModalOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Governança e Segurança · HU-MIPC-13
          </span>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
            Gestão de Usuários e Permissões (RBAC)
          </h1>
          <p className="mt-0.5 text-sm text-purple-900">
            Gerencie perfis de acesso, revogue sessões instantaneamente e acompanhe a trilha de
            auditoria.
          </p>
        </div>

        <Button type="button" onClick={() => setModalOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {feedback && (
        <FeedbackBanner variant="success" message={feedback} onDismiss={() => setFeedback(null)} />
      )}

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">
            <Shield className="h-4 w-4" />
            Usuários e Perfis ({users.length})
          </TabsTrigger>
          <TabsTrigger value="auditoria">
            <History className="h-4 w-4" />
            Trilha de Auditoria ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Contas Cadastradas</CardTitle>
              <CardDescription>
                Alterar o status para &ldquo;Inativo / Bloqueado&rdquo; encerra imediatamente todas
                as sessões e impede novo login na tela de acesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {users.map((u) => {
                const blocked = u.status === 'Inativo / Bloqueado'
                return (
                  <div
                    key={u.id}
                    className={`rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                      blocked
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-purple-600 bg-purple-100/50'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-serif text-base font-bold text-blue-900">
                          {u.name}
                        </span>
                        <Badge variant={blocked ? 'critical' : 'excellent'}>{u.status}</Badge>
                      </div>
                      <p className="text-xs text-purple-900 break-all">
                        {u.email} ·{' '}
                        <span className="tabular-nums">
                          {u.activeSessions} sessão(ões) ativa(s)
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="w-56 max-w-full">
                        <Select
                          value={u.role}
                          onValueChange={(nextRole) => {
                            updateUserRole(u.id, nextRole as PlatformRole)
                            setFeedback(`Perfil de ${u.name} atualizado para "${nextRole}".`)
                          }}
                        >
                          <SelectTrigger aria-label={`Perfil de ${u.name}`} className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORM_ROLES.map((r) => (
                              <SelectItem key={r.role} value={r.role}>
                                {r.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={blocked ? 'outline' : 'destructive'}
                        onClick={() => {
                          const next = toggleUserStatus(u.id)
                          setFeedback(
                            next === 'Inativo / Bloqueado'
                              ? `Conta ${u.email} bloqueada e sessões encerradas imediatamente.`
                              : `Conta ${u.email} reativada.`,
                          )
                        }}
                      >
                        {blocked ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            Reativar
                          </>
                        ) : (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            Bloquear
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Compact RBAC Matrix */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Matriz de Permissões por Perfil (RBAC)</CardTitle>
              <CardDescription>
                Escopo autorizado na plataforma (credenciais protegidas com bcrypt + JWT).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              {PLATFORM_ROLES.map((item) => (
                <div
                  key={item.role}
                  className="rounded-lg border border-purple-500 bg-purple-100/60 p-3 space-y-1"
                >
                  <p className="font-semibold text-blue-900">{item.role}</p>
                  <p className="text-purple-900">{item.scope}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Trilha de Auditoria (Audit Log)</CardTitle>
              <CardDescription>
                Registro de criações, alterações de papel e revogações com data/hora, ator e IP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-purple-600 bg-purple-100/60 p-3.5 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant={log.action.includes('Revogação') ? 'critical' : 'default'}
                    >
                      {log.action}
                    </Badge>
                    <span className="text-purple-900 tabular-nums">
                      {new Date(log.timestamp).toLocaleString('pt-BR')} · Ator:{' '}
                      <strong>{log.actorId}</strong> · IP {log.ipAddress}
                    </span>
                  </div>
                  <p className="font-semibold text-blue-900">{log.targetEmail}</p>
                  <p className="text-purple-900">{log.details}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New User Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            <DialogDescription>
              Um link de ativação e definição de senha inicial será enviado ao e-mail informado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="usr-name">Nome Completo *</Label>
              <Input
                id="usr-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Fernanda Costa"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usr-email">E-mail *</Label>
              <Input
                id="usr-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fernanda@fundacaoagualimpa.org.br"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usr-role">Perfil de Acesso (RBAC) *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as PlatformRole)}>
                <SelectTrigger id="usr-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_ROLES.map((r) => (
                    <SelectItem key={r.role} value={r.role}>
                      {r.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cadastrar e Enviar Convite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
