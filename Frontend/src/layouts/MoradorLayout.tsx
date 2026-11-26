import { NavLink, Outlet, useNavigate } from 'react-router'
import {
  Bell,
  Droplets,
  LogOut,
  MessageSquareWarning,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useMipc } from '@/context/MipcStore'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/morador/agua', label: 'Qualidade da Água', icon: ShieldCheck },
  { to: '/morador/comunicados', label: 'Comunicados e Saúde', icon: Bell },
  { to: '/morador/ouvidoria', label: 'Ouvidoria Digital', icon: MessageSquareWarning },
]

function MoradorShell() {
  const navigate = useNavigate()
  const { announcements, resetDemoData } = useMipc()
  const { open, setOpenMobile } = useSidebar()

  const unreadCount = announcements.filter((a) => !a.read).length

  return (
    <>
      <Sidebar>
        <div>
          <div className="flex items-center justify-between px-4 py-5 border-b border-blue-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-blue-900">
                <Droplets className="h-5 w-5" />
              </div>
              <div className={cn('min-w-0', !open && 'lg:hidden')}>
                <span className="font-serif text-lg font-bold leading-tight block truncate">
                  Fundação Água Limpa
                </span>
                <span className="text-[11px] uppercase tracking-wider text-blue-200 block truncate">
                  MIPC · Morador
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenMobile(false)}
              className="lg:hidden rounded-md p-1 text-blue-100 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1.5" aria-label="Navegação do Morador">
            <p
              className={cn(
                'px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-blue-200',
                !open && 'lg:hidden',
              )}
            >
              Minha Comunidade
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  onClick={() => setOpenMobile(false)}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
                      open ? 'justify-between' : 'justify-between lg:justify-center lg:px-0',
                      isActive
                        ? 'bg-orange-500 text-blue-900 font-semibold shadow-xs'
                        : 'text-blue-100 hover:bg-blue-800 hover:text-white',
                    )
                  }
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={cn(!open && 'lg:hidden')}>{item.label}</span>
                  </span>
                  {item.to === '/morador/comunicados' && unreadCount > 0 && (
                    <span
                      className={cn(
                        'rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white',
                        !open && 'lg:absolute lg:right-1.5 lg:top-1 lg:px-1.5 lg:text-[10px]',
                      )}
                    >
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-blue-800 space-y-3">
          <div className={cn('rounded-lg bg-blue-800/80 p-3 text-xs', !open && 'lg:hidden')}>
            <p className="font-semibold text-white">João da Silva</p>
            <p className="text-blue-200">Morador · Setor Norte</p>
            <p className="mt-1 text-[11px] text-blue-200">Assentamento Santa Luzia — DF</p>
          </div>

          <div className={cn('flex gap-2', !open && 'lg:flex-col')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetDemoData}
              className="flex-1 border-blue-700 bg-blue-800 text-blue-100 hover:bg-blue-700 hover:text-white"
              title="Recarregar dados do Supabase"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className={cn(!open && 'lg:hidden')}>Atualizar Dados</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/login')}
              title="Sair"
              className="border-blue-700 bg-blue-800 text-blue-100 hover:bg-blue-700 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className={cn(!open && 'lg:hidden')}>Sair</span>
            </Button>
          </div>
        </div>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-purple-600 bg-purple-50/95 px-4 sm:px-6 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            <SidebarTrigger />
            <div className="h-5 w-px bg-purple-600 shrink-0" />
            <p className="font-serif text-base font-bold text-blue-900 truncate">
              Portal do Morador{' '}
              <span className="font-sans text-xs font-normal text-purple-900 hidden sm:inline">
                · Assentamento Santa Luzia
              </span>
            </p>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-purple-600 bg-white px-3 py-1 text-xs font-medium text-blue-900 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Consulta simplificada
          </span>
        </header>

        <main className="flex-1 bg-purple-50 p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>

        <footer className="bg-blue-900 text-blue-100 px-6 py-4 text-xs">
          <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-2">
            <span className="font-serif text-sm font-bold text-white">
              Fundação Água Limpa — MIPC
            </span>
            <span>Assentamento Santa Luzia · Brasília — DF</span>
          </div>
        </footer>
      </SidebarInset>
    </>
  )
}

export function MoradorLayout() {
  return (
    <SidebarProvider>
      <MoradorShell />
    </SidebarProvider>
  )
}
