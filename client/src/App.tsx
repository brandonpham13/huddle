import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { LeaguesPage } from './pages/LeaguesPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
        <Route path="/leagues" element={<AuthGuard><LeaguesPage /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
