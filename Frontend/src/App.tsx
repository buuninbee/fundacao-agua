import { Navigate, Route, Routes } from 'react-router'
import { MipcProvider } from '@/context/MipcStore'
import { FiscalLayout } from '@/layouts/FiscalLayout'
import { LiderancaLayout } from '@/layouts/LiderancaLayout'
import { MoradorLayout } from '@/layouts/MoradorLayout'
import { LoginPage } from '@/pages/LoginPage'
import { AccessControlPage } from '@/pages/fiscal/AccessControlPage'
import { BulletinsPage } from '@/pages/fiscal/BulletinsPage'
import { CalibrationPage } from '@/pages/fiscal/CalibrationPage'
import { IotHealthPage } from '@/pages/fiscal/IotHealthPage'
import { MaintenancePage } from '@/pages/fiscal/MaintenancePage'
import { MonitoringPage } from '@/pages/fiscal/MonitoringPage'
import { EmergenciesPage } from '@/pages/lideranca/EmergenciesPage'
import { IndicatorsPage } from '@/pages/lideranca/IndicatorsPage'
import { WorkshopsPage } from '@/pages/lideranca/WorkshopsPage'
import { AnnouncementsPage } from '@/pages/morador/AnnouncementsPage'
import { OmbudsmanPage } from '@/pages/morador/OmbudsmanPage'
import { WaterQualityPage } from '@/pages/morador/WaterQualityPage'

export function App() {
  return (
    <MipcProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Persona 1: Fiscal / Agente de Campo + IoT & TI (HU-MIPC-01 a 03, 11 a 13) */}
        <Route path="/fiscal" element={<FiscalLayout />}>
          <Route index element={<Navigate to="monitoramento" replace />} />
          <Route path="monitoramento" element={<MonitoringPage />} />
          <Route path="manutencao" element={<MaintenancePage />} />
          <Route path="boletins" element={<BulletinsPage />} />
          <Route path="iot-saude" element={<IotHealthPage />} />
          <Route path="calibracao" element={<CalibrationPage />} />
          <Route path="acessos" element={<AccessControlPage />} />
        </Route>

        {/* Persona 2: Morador do Assentamento Santa Luzia (HU-MIPC-04 a 06) */}
        <Route path="/morador" element={<MoradorLayout />}>
          <Route index element={<Navigate to="agua" replace />} />
          <Route path="agua" element={<WaterQualityPage />} />
          <Route path="comunicados" element={<AnnouncementsPage />} />
          <Route path="ouvidoria" element={<OmbudsmanPage />} />
        </Route>

        {/* Persona 3: Liderança Comunitária (HU-MIPC-07 a 09) */}
        <Route path="/lideranca" element={<LiderancaLayout />}>
          <Route index element={<Navigate to="indicadores" replace />} />
          <Route path="indicadores" element={<IndicatorsPage />} />
          <Route path="urgencias" element={<EmergenciesPage />} />
          <Route path="workshops" element={<WorkshopsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </MipcProvider>
  )
}
