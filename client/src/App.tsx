import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { AccountModalProvider } from './components/AccountModal'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { LeaguesPage } from './pages/LeaguesPage'

export default function App() {
  return (
    <BrowserRouter>
      <AccountModalProvider>
        <Routes>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/account" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<Navigate to="/" replace />} />
          <Route path="/leagues" element={<AuthGuard><LeaguesPage /></AuthGuard>} />
        </Routes>
      </AccountModalProvider>
    </BrowserRouter>
  )
}
