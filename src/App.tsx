import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import PilotsPage from './pages/PilotsPage'
import PilotDetailPage from './pages/PilotDetailPage'
import MechsPage from './pages/MechsPage'
import MechDetailPage from './pages/MechDetailPage'
import WeaponsPage from './pages/WeaponsPage'
import BackpacksPage from './pages/BackpacksPage'
import ModulesPage from './pages/ModulesPage'
import SimulatorPage from './pages/SimulatorPage'
import ResearchPage from './pages/ResearchPage'
import NewsPage from './pages/NewsPage'
import GuidesPage from './pages/GuidesPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <BrowserRouter basename="/mecharashi-tools">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="pilots" element={<PilotsPage />} />
          <Route path="pilots/:id" element={<PilotDetailPage />} />
          <Route path="mechs" element={<MechsPage />} />
          <Route path="mechs/:id" element={<MechDetailPage />} />
          <Route path="weapons" element={<WeaponsPage />} />
          <Route path="backpacks" element={<BackpacksPage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="simulator" element={<SimulatorPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="guides" element={<GuidesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
