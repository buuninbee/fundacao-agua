import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}

export function SidebarProvider({
  defaultOpen = true,
  children,
}: {
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [openMobile, setOpenMobile] = useState(false)

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setOpen((prev) => !prev)
    } else {
      setOpenMobile((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar])

  return (
    <SidebarContext.Provider
      value={{ open, setOpen, openMobile, setOpenMobile, toggleSidebar }}
    >
      <div className="min-h-screen w-full flex bg-purple-100 text-blue-900">
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function Sidebar({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const { open, openMobile, setOpenMobile } = useSidebar()

  return (
    <>
      {openMobile && (
        <div
          className="fixed inset-0 z-30 bg-blue-900/40 lg:hidden"
          onClick={() => setOpenMobile(false)}
        />
      )}
      <aside
        data-state={open ? 'expanded' : 'collapsed'}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col justify-between bg-blue-900 text-white transition-[width,transform] lg:sticky lg:top-0 lg:h-screen lg:shrink-0',
          openMobile ? 'translate-x-0 w-72 duration-200' : '-translate-x-full w-72 duration-150 lg:translate-x-0',
          open ? 'lg:w-72 lg:duration-200' : 'lg:w-[72px] lg:duration-150',
          className,
        )}
      >
        {children}
      </aside>
    </>
  )
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { open, toggleSidebar } = useSidebar()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label={open ? 'Recolher menu lateral' : 'Expandir menu lateral'}
      title="Alternar menu lateral (Ctrl+B)"
      className={cn('h-9 w-9 text-blue-900 hover:bg-purple-200', className)}
    >
      <PanelLeft className="h-5 w-5" />
    </Button>
  )
}

export function SidebarInset({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex-1 flex flex-col min-w-0', className)} {...props} />
  )
}
