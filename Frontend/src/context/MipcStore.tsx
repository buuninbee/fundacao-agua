import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchAllMipcData,
  insertBulletinDb,
  insertCalibrationDb,
  insertEmergencyDb,
  insertHardwareSwapDb,
  insertMaintenanceDb,
  insertOmbudsmanTicketDb,
  insertPlatformUserDb,
  insertVisitDb,
  insertWorkshopDb,
  markAnnouncementReadDb,
  resolveEmergencyDb,
  updatePlatformUserRoleDb,
  updatePlatformUserStatusDb,
  updateVisitStatusDb,
  updateWorkshopParticipantsDb,
  type MipcDataSnapshot,
} from '@/lib/mipcApi'
import {
  addDaysToIsoDate,
  applyWorkshopRsvp,
  formatOmbudsmanProtocol,
  formatUrgencyProtocol,
} from '@/lib/waterRules'
import type {
  Announcement,
  AuditLogEntry,
  CalibrationRecord,
  EmergencyReport,
  FieldVisit,
  HardwareSwapRecord,
  MaintenanceRecord,
  OmbudsmanTicket,
  PlatformRole,
  PlatformUser,
  TechnicalBulletin,
  UserAccountStatus,
  Workshop,
} from '@/types/mipc'

const EMPTY_STATE: MipcDataSnapshot = {
  wells: [],
  visits: [],
  maintenances: [],
  bulletins: [],
  announcements: [],
  tickets: [],
  emergencies: [],
  workshops: [],
  iotDevices: [],
  calibrations: [],
  hardwareSwaps: [],
  users: [],
  auditLogs: [],
}

interface MipcContextValue extends MipcDataSnapshot {
  loading: boolean
  syncError: string | null
  refreshData: () => Promise<void>
  scheduleVisit: (visit: Omit<FieldVisit, 'id' | 'createdAt' | 'status'>) => FieldVisit
  updateVisitStatus: (visitId: string, status: FieldVisit['status']) => void
  addMaintenance: (
    record: Omit<MaintenanceRecord, 'id' | 'createdAt'>,
  ) => MaintenanceRecord
  addBulletin: (
    bulletin: Omit<TechnicalBulletin, 'id' | 'protocolCode' | 'generatedAt'>,
  ) => TechnicalBulletin
  markAnnouncementRead: (announcementId: string) => void
  addOmbudsmanTicket: (
    ticket: Omit<OmbudsmanTicket, 'id' | 'protocolCode' | 'status' | 'createdAt'>,
  ) => OmbudsmanTicket
  addEmergencyReport: (
    report: Omit<
      EmergencyReport,
      'id' | 'protocolCode' | 'slaHours' | 'notifiedChannels' | 'status' | 'createdAt'
    >,
  ) => EmergencyReport
  resolveEmergency: (emergencyId: string) => void
  createWorkshop: (
    workshop: Omit<Workshop, 'id' | 'participants' | 'createdAt'>,
  ) => Workshop
  rsvpWorkshop: (
    workshopId: string,
    residentName: string,
    action: 'join' | 'cancel',
  ) => 'confirmed' | 'waitlist' | 'cancelled' | 'unchanged'
  toggleWorkshopCheckIn: (workshopId: string, residentName: string) => void
  addCalibration: (
    record: Omit<CalibrationRecord, 'id' | 'version' | 'createdAt'>,
  ) => CalibrationRecord
  addHardwareSwap: (
    record: Omit<HardwareSwapRecord, 'id' | 'createdAt'>,
  ) => HardwareSwapRecord
  addPlatformUser: (input: { name: string; email: string; role: PlatformRole }) => PlatformUser
  updateUserRole: (userId: string, role: PlatformRole) => void
  toggleUserStatus: (userId: string) => UserAccountStatus | null
  resetDemoData: () => void
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const MipcContext = createContext<MipcContextValue | null>(null)

export function MipcProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MipcDataSnapshot>(EMPTY_STATE)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initialError, setInitialError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Maps temporary optimistic IDs -> real Postgres bigint IDs for identity tables
  const idMapRef = useRef<Map<string, string>>(new Map())

  const resolveId = (id: string): string => idMapRef.current.get(id) ?? id

  const persist = useCallback((task: () => Promise<void>) => {
    setSyncError(null)
    void task().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao sincronizar com o Supabase.'
      console.error('[MipcStore]', msg)
      setSyncError(msg)
    })
  }, [])

  const refreshData = useCallback(async () => {
    setLoading(true)
    setSyncError(null)
    try {
      const snapshot = await fetchAllMipcData()
      setState(snapshot)
      setInitialError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar dados do Supabase.'
      console.error('[MipcStore]', msg)
      setInitialError(msg)
      setSyncError(msg)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  function scheduleVisit(
    visitInput: Omit<FieldVisit, 'id' | 'createdAt' | 'status'>,
  ): FieldVisit {
    const tempId = `visit-tmp-${Date.now()}`
    const visit: FieldVisit = {
      ...visitInput,
      id: tempId,
      status: 'Agendada',
      createdAt: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      visits: [visit, ...prev.visits],
    }))
    persist(async () => {
      const realId = await insertVisitDb(visit)
      idMapRef.current.set(tempId, realId)
      setState((prev) => ({
        ...prev,
        visits: prev.visits.map((v) => (v.id === tempId ? { ...v, id: realId } : v)),
      }))
    })
    return visit
  }

  function updateVisitStatus(visitId: string, status: FieldVisit['status']) {
    const resolved = resolveId(visitId)
    setState((prev) => ({
      ...prev,
      visits: prev.visits.map((v) =>
        v.id === visitId || v.id === resolved ? { ...v, status } : v,
      ),
    }))
    persist(() => updateVisitStatusDb(resolved, status))
  }

  function addMaintenance(
    recordInput: Omit<MaintenanceRecord, 'id' | 'createdAt'>,
  ): MaintenanceRecord {
    const nowIso = new Date().toISOString()
    const todayDate = nowIso.slice(0, 10)
    const nextCycleDate = addDaysToIsoDate(todayDate, 90)

    const record: MaintenanceRecord = {
      ...recordInput,
      id: newUuid(),
      createdAt: nowIso,
    }

    setState((prev) => ({
      ...prev,
      maintenances: [record, ...prev.maintenances],
      wells: prev.wells.map((well) =>
        well.id === record.wellId
          ? {
              ...well,
              lastMaintenanceDate: todayDate,
              nextMaintenanceDate: nextCycleDate,
            }
          : well,
      ),
    }))
    persist(() => insertMaintenanceDb(record, todayDate, nextCycleDate))
    return record
  }

  function addBulletin(
    bulletinInput: Omit<TechnicalBulletin, 'id' | 'protocolCode' | 'generatedAt'>,
  ): TechnicalBulletin {
    const year = new Date().getFullYear()
    const seq = String(state.bulletins.length + 15).padStart(4, '0')
    const bulletin: TechnicalBulletin = {
      ...bulletinInput,
      id: newUuid(),
      protocolCode: `BT-MIPC-${year}-${seq}`,
      generatedAt: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      bulletins: [bulletin, ...prev.bulletins],
    }))
    persist(() => insertBulletinDb(bulletin))
    return bulletin
  }

  function markAnnouncementRead(announcementId: string) {
    setState((prev) => ({
      ...prev,
      announcements: prev.announcements.map((a) =>
        a.id === announcementId ? { ...a, read: true } : a,
      ),
    }))
    persist(() => markAnnouncementReadDb(announcementId))
  }

  function addOmbudsmanTicket(
    ticketInput: Omit<OmbudsmanTicket, 'id' | 'protocolCode' | 'status' | 'createdAt'>,
  ): OmbudsmanTicket {
    const year = new Date().getFullYear()
    const nextSeq = 140 + state.tickets.length
    const ticket: OmbudsmanTicket = {
      ...ticketInput,
      id: newUuid(),
      protocolCode: formatOmbudsmanProtocol(year, nextSeq),
      status: 'Registrado',
      createdAt: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      tickets: [ticket, ...prev.tickets],
    }))
    persist(() => insertOmbudsmanTicketDb(ticket))
    return ticket
  }

  function addEmergencyReport(
    reportInput: Omit<
      EmergencyReport,
      'id' | 'protocolCode' | 'slaHours' | 'notifiedChannels' | 'status' | 'createdAt'
    >,
  ): EmergencyReport {
    const nowIso = new Date().toISOString()
    const year = new Date().getFullYear()
    const nextSeq = 11 + state.emergencies.length
    const report: EmergencyReport = {
      ...reportInput,
      id: newUuid(),
      protocolCode: formatUrgencyProtocol(year, nextSeq),
      slaHours: 2,
      notifiedChannels: ['Push', 'E-mail prioritário', 'SMS'],
      status: 'Em Atendimento',
      createdAt: nowIso,
    }

    const emergencyAnnouncement: Announcement = {
      id: newUuid(),
      title: `EMERGÊNCIA: ${report.wellName} interditado (${report.category})`,
      category: 'Alerta Operacional',
      priority: 'Crítico',
      summary: `Protocolo ${report.protocolCode} aberto pela Liderança Comunitária. Não consuma a água deste poço.`,
      body:
        report.description ||
        `Ocorrência de ${report.category} reportada com evidência de campo. Equipe da ONG acionada com SLA de 2 horas.`,
      wellName: report.wellName,
      scheduleWindow: 'Interditado / Emergência — SLA de resposta 2h',
      publishedAt: nowIso,
      read: false,
    }

    const tempVisitId = `visit-urg-tmp-${Date.now()}`
    const urgentVisit: FieldVisit = {
      id: tempVisitId,
      wellId: report.wellId,
      wellName: report.wellName,
      location: `Urgência GPS (${report.gpsCoords.latitude.toFixed(4)}, ${report.gpsCoords.longitude.toFixed(4)})`,
      scheduledDate: nowIso.slice(0, 10),
      scheduledTime: 'Imediato (SLA 2h)',
      priority: 'Alta',
      reason: `[${report.protocolCode}] ${report.category}: ${report.description || 'Evidência anexada pela Liderança.'}`,
      assignedInspector: 'Equipe de Plantão da ONG',
      recentSummary: `~${report.affectedFamilies} famílias afetadas`,
      status: 'Agendada',
      createdAt: nowIso,
    }

    const interdictionReason = `${report.category} (${report.protocolCode}) — Equipe de campo acionada (SLA 2h).`

    setState((prev) => ({
      ...prev,
      emergencies: [report, ...prev.emergencies],
      announcements: [emergencyAnnouncement, ...prev.announcements],
      visits: [urgentVisit, ...prev.visits],
      wells: prev.wells.map((w) =>
        w.id === report.wellId
          ? {
              ...w,
              interdicted: true,
              interdictionReason,
            }
          : w,
      ),
    }))

    persist(async () => {
      const realVisitId = await insertEmergencyDb(
        report,
        emergencyAnnouncement,
        urgentVisit,
        interdictionReason,
      )
      idMapRef.current.set(tempVisitId, realVisitId)
      setState((prev) => ({
        ...prev,
        visits: prev.visits.map((v) => (v.id === tempVisitId ? { ...v, id: realVisitId } : v)),
      }))
    })
    return report
  }

  function resolveEmergency(emergencyId: string) {
    const target = state.emergencies.find((e) => e.id === emergencyId)
    setState((prev) => ({
      ...prev,
      emergencies: prev.emergencies.map((e) =>
        e.id === emergencyId ? { ...e, status: 'Resolvida' } : e,
      ),
      wells: target
        ? prev.wells.map((w) =>
            w.id === target.wellId
              ? { ...w, interdicted: false, interdictionReason: undefined }
              : w,
          )
        : prev.wells,
    }))
    persist(() => resolveEmergencyDb(emergencyId, target?.wellId))
  }

  function createWorkshop(
    input: Omit<Workshop, 'id' | 'participants' | 'createdAt'>,
  ): Workshop {
    const nowIso = new Date().toISOString()
    const created: Workshop = {
      ...input,
      id: newUuid(),
      participants: [],
      createdAt: nowIso,
    }
    const invite: Announcement = {
      id: newUuid(),
      title: `Novo Workshop: ${created.title}`,
      category: 'Educação Sanitária',
      priority: 'Educativo',
      summary: `${created.agenda} (${created.maxSeats} vagas · ${created.location}).`,
      body: `Facilitador(a): ${created.facilitator}. Local: ${created.location}. Confirme sua presença na aba Eventos e Capacitações.`,
      publishedAt: nowIso,
      read: false,
    }
    setState((prev) => ({
      ...prev,
      workshops: [created, ...prev.workshops],
      announcements: [invite, ...prev.announcements],
    }))
    persist(() => insertWorkshopDb(created, invite))
    return created
  }

  function rsvpWorkshop(
    workshopId: string,
    residentName: string,
    action: 'join' | 'cancel',
  ): 'confirmed' | 'waitlist' | 'cancelled' | 'unchanged' {
    const target = state.workshops.find((w) => w.id === workshopId)
    if (!target) return 'unchanged'
    const result = applyWorkshopRsvp(target, residentName, action)
    if (result.outcome !== 'unchanged') {
      setState((prev) => ({
        ...prev,
        workshops: prev.workshops.map((w) => (w.id === workshopId ? result.workshop : w)),
      }))
      persist(() => updateWorkshopParticipantsDb(workshopId, result.workshop.participants))
    }
    return result.outcome
  }

  function toggleWorkshopCheckIn(workshopId: string, residentName: string) {
    const target = state.workshops.find((w) => w.id === workshopId)
    if (!target) return
    const nextParticipants = target.participants.map((p) =>
      p.name === residentName ? { ...p, checkedIn: !p.checkedIn } : p,
    )
    setState((prev) => ({
      ...prev,
      workshops: prev.workshops.map((w) =>
        w.id === workshopId ? { ...w, participants: nextParticipants } : w,
      ),
    }))
    persist(() => updateWorkshopParticipantsDb(workshopId, nextParticipants))
  }

  function addCalibration(
    input: Omit<CalibrationRecord, 'id' | 'version' | 'createdAt'>,
  ): CalibrationRecord {
    const existingCount = state.calibrations.filter(
      (c) => c.wellId === input.wellId && c.sensor === input.sensor,
    ).length
    const record: CalibrationRecord = {
      ...input,
      id: newUuid(),
      version: existingCount + 1,
      createdAt: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      calibrations: [record, ...prev.calibrations],
    }))
    persist(() => insertCalibrationDb(record))
    return record
  }

  function addHardwareSwap(
    input: Omit<HardwareSwapRecord, 'id' | 'createdAt'>,
  ): HardwareSwapRecord {
    const record: HardwareSwapRecord = {
      ...input,
      id: newUuid(),
      createdAt: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      hardwareSwaps: [record, ...prev.hardwareSwaps],
    }))
    persist(() => insertHardwareSwapDb(record))
    return record
  }

  function addPlatformUser(input: {
    name: string
    email: string
    role: PlatformRole
  }): PlatformUser {
    const nowIso = new Date().toISOString()
    const tempId = `usr-tmp-${Date.now()}`
    const created: PlatformUser = {
      id: tempId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      status: 'Ativo',
      activeSessions: 0,
      createdAt: nowIso,
    }
    const log: AuditLogEntry = {
      id: newUuid(),
      timestamp: nowIso,
      actorId: 'FISC-014',
      ipAddress: '187.54.210.14',
      action: 'Criação de Usuário',
      targetEmail: created.email,
      details: `Perfil ${created.role} vinculado; e-mail de ativação disparado.`,
    }
    setState((prev) => ({
      ...prev,
      users: [created, ...prev.users],
      auditLogs: [log, ...prev.auditLogs],
    }))
    persist(async () => {
      const realId = await insertPlatformUserDb(created, log)
      idMapRef.current.set(tempId, realId)
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === tempId ? { ...u, id: realId } : u)),
      }))
    })
    return created
  }

  function updateUserRole(userId: string, role: PlatformRole) {
    const resolved = resolveId(userId)
    const target = state.users.find((u) => u.id === userId || u.id === resolved)
    if (!target || target.role === role) return
    const nowIso = new Date().toISOString()
    const log: AuditLogEntry = {
      id: newUuid(),
      timestamp: nowIso,
      actorId: 'FISC-014',
      ipAddress: '187.54.210.14',
      action: 'Alteração de Perfil',
      targetEmail: target.email,
      details: `Perfil alterado de ${target.role} para ${role}.`,
    }
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId || u.id === resolved ? { ...u, role } : u,
      ),
      auditLogs: [log, ...prev.auditLogs],
    }))
    persist(() => updatePlatformUserRoleDb(resolved, role, log))
  }

  function toggleUserStatus(userId: string): UserAccountStatus | null {
    const resolved = resolveId(userId)
    const target = state.users.find((u) => u.id === userId || u.id === resolved)
    if (!target) return null
    const nextStatus: UserAccountStatus =
      target.status === 'Ativo' ? 'Inativo / Bloqueado' : 'Ativo'
    const nextSessions = nextStatus === 'Inativo / Bloqueado' ? 0 : target.activeSessions
    const nowIso = new Date().toISOString()
    const log: AuditLogEntry = {
      id: newUuid(),
      timestamp: nowIso,
      actorId: 'FISC-014',
      ipAddress: '187.54.210.14',
      action: nextStatus === 'Inativo / Bloqueado' ? 'Revogação de Acesso' : 'Reativação de Conta',
      targetEmail: target.email,
      details:
        nextStatus === 'Inativo / Bloqueado'
          ? `Status alterado para Inativo / Bloqueado; ${target.activeSessions} sessão(ões) encerrada(s) imediatamente.`
          : 'Conta reativada pelo administrador.',
    }
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId || u.id === resolved
          ? {
              ...u,
              status: nextStatus,
              activeSessions: nextSessions,
            }
          : u,
      ),
      auditLogs: [log, ...prev.auditLogs],
    }))
    persist(() => updatePlatformUserStatusDb(resolved, nextStatus, nextSessions, log))
    return nextStatus
  }

  function resetDemoData() {
    void refreshData()
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-purple-50 flex flex-col items-center justify-center p-6 text-blue-900">
        <p className="font-serif text-xl font-bold">Fundação Água Limpa — MIPC</p>
        <p className="mt-2 text-sm text-purple-900">
          Carregando dados em tempo real do Supabase...
        </p>
      </div>
    )
  }

  if (initialError && state.wells.length === 0) {
    return (
      <div className="min-h-screen bg-purple-50 flex flex-col items-center justify-center p-6 text-center text-blue-900">
        <p className="font-serif text-xl font-bold">Não foi possível conectar ao Supabase</p>
        <p className="mt-2 max-w-md text-sm text-purple-900">{initialError}</p>
        <button
          type="button"
          onClick={() => void refreshData()}
          className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-orange-600"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <MipcContext.Provider
      value={{
        ...state,
        loading,
        syncError,
        refreshData,
        scheduleVisit,
        updateVisitStatus,
        addMaintenance,
        addBulletin,
        markAnnouncementRead,
        addOmbudsmanTicket,
        addEmergencyReport,
        resolveEmergency,
        createWorkshop,
        rsvpWorkshop,
        toggleWorkshopCheckIn,
        addCalibration,
        addHardwareSwap,
        addPlatformUser,
        updateUserRole,
        toggleUserStatus,
        resetDemoData,
      }}
    >
      {syncError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900 shadow-md"
        >
          <p className="font-semibold">Erro ao sincronizar com Supabase</p>
          <p className="mt-0.5">{syncError}</p>
        </div>
      )}
      {children}
    </MipcContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMipc(): MipcContextValue {
  const ctx = useContext(MipcContext)
  if (!ctx) {
    throw new Error('useMipc deve ser utilizado dentro de MipcProvider')
  }
  return ctx
}
