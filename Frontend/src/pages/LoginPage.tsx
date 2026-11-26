import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Droplets, ShieldCheck, Activity, ArrowRight } from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type PersonaRole = 'fiscal' | 'morador' | 'lideranca'

const PERSONA_DEFAULTS: Record<PersonaRole, { email: string; route: string; cta: string; desc: string }> = {
  fiscal: {
    email: 'mariana.souza@fundacaoagualimpa.org.br',
    route: '/fiscal/monitoramento',
    cta: 'Entrar no Painel do Fiscal',
    desc: 'Acompanhe sensores IoT, registre manutenções e emita boletins técnicos.',
  },
  morador: {
    email: 'joao.silva@santaluzia.com.br',
    route: '/morador/agua',
    cta: 'Entrar como Morador',
    desc: 'Consulte a segurança da água do seu poço, avisos e ouvidoria comunitária.',
  },
  lideranca: {
    email: 'rosa.oliveira@santaluzia.org.br',
    route: '/lideranca/indicadores',
    cta: 'Entrar como Liderança',
    desc: 'Acompanhe indicadores do território, reporte urgências e gerencie workshops.',
  },
}

export function LoginPage() {
  const navigate = useNavigate()
  const { users } = useMipc()
  const [role, setRole] = useState<PersonaRole>('fiscal')
  const [email, setEmail] = useState(PERSONA_DEFAULTS.fiscal.email)
  const [password, setPassword] = useState('••••••••••••')
  const [loginError, setLoginError] = useState<string | null>(null)

  function handleRoleChange(nextRole: string) {
    const r = nextRole as PersonaRole
    setRole(r)
    setEmail(PERSONA_DEFAULTS[r].email)
    setLoginError(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const account = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (account && account.status === 'Inativo / Bloqueado') {
      // Exact HU-MIPC-13 BDD Cenário 2 rejection message
      setLoginError('Acesso suspenso pelo administrador da plataforma')
      return
    }
    setLoginError(null)
    navigate(PERSONA_DEFAULTS[role].route)
  }

  return (
    <div className="min-h-screen bg-purple-50 flex flex-col lg:flex-row">
      {/* Institutional brand panel - bg-blue-900 per design.md */}
      <aside className="bg-blue-900 text-white lg:w-[46%] xl:w-[44%] p-6 sm:p-8 lg:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-xl bg-orange-500 text-blue-900 shadow-sm shrink-0">
              <Droplets className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <div>
              <span className="font-serif text-lg lg:text-xl font-bold tracking-tight block">
                Fundação Água Limpa
              </span>
              <span className="text-xs uppercase tracking-widest text-blue-200">
                Plataforma MIPC
              </span>
            </div>
          </div>

          <div className="mt-5 lg:mt-20 max-w-md">
            <p className="hidden lg:block text-xs font-semibold uppercase tracking-widest text-orange-400">
              Monitoramento Inteligente de Poços Comunitários
            </p>
            <h1 className="lg:mt-3 font-serif text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-white">
              Segurança hídrica em tempo real para o Assentamento Santa Luzia.
            </h1>
            <p className="hidden lg:block mt-4 text-base leading-relaxed text-blue-100">
              Acompanhe sensores IoT de qualidade da água, registre manutenções preventivas em
              campo e emita boletins técnicos georreferenciados.
            </p>

            <div className="hidden lg:grid mt-10 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-blue-700 bg-blue-800/70 p-4">
                <Activity className="h-5 w-5 text-orange-400" />
                <p className="mt-2 font-serif text-base font-bold text-white">Telemetria IoT</p>
                <p className="mt-1 text-xs text-blue-100">
                  Alertas automáticos de pH, turbidez, temperatura e falhas de comunicação.
                </p>
              </div>
              <div className="rounded-lg border border-blue-700 bg-blue-800/70 p-4">
                <ShieldCheck className="h-5 w-5 text-orange-400" />
                <p className="mt-2 font-serif text-base font-bold text-white">Respaldo Técnico</p>
                <p className="mt-1 text-xs text-blue-100">
                  Boletins técnicos georreferenciados em PDF com verificação de integridade SHA-256.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="hidden lg:flex mt-12 border-t border-blue-800 pt-5 text-xs text-blue-200 flex-wrap items-center justify-between gap-2">
          <span>ONG Fundação Água Limpa · Brasília — DF</span>
          <span>5.000 famílias protegidas</span>
        </footer>
      </aside>

      {/* Visual Login Form panel - bg-purple-50/100 per design.md */}
      <main className="flex-1 bg-purple-100 flex items-center justify-center p-4 sm:p-10">
        <div className="w-full max-w-md">
          <Card className="border-purple-600 shadow-sm">
            <CardHeader className="pb-4">
              <Tabs value={role} onValueChange={handleRoleChange}>
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="fiscal" className="px-2 text-xs sm:text-sm">
                    Fiscal
                  </TabsTrigger>
                  <TabsTrigger value="morador" className="px-2 text-xs sm:text-sm">
                    Morador
                  </TabsTrigger>
                  <TabsTrigger value="lideranca" className="px-2 text-xs sm:text-sm">
                    Liderança
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <CardTitle className="mt-3 text-2xl">Acessar Plataforma MIPC</CardTitle>
              <CardDescription>{PERSONA_DEFAULTS[role].desc}</CardDescription>
            </CardHeader>

            <CardContent>
              {loginError && (
                <div className="mb-4">
                  <FeedbackBanner variant="error" message={loginError} />
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                  />
                </div>

                <Button type="submit" size="lg" className="w-full mt-2">
                  {PERSONA_DEFAULTS[role].cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
