import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserProfile, useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSleeperUsername, setSleeperUserId } from '../store/slices/authSlice'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'

export function AccountPage() {
  const { getToken } = useAuth()
  const dispatch = useAppDispatch()
  const sleeperUsername = useAppSelector(state => state.auth.user?.sleeperUsername)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const patchSleeperUsername = async (value: string | null) => {
    const token = await getToken()
    const res = await axios.patch<{ sleeperUsername: string | null; sleeperUserId: string | null }>(
      '/api/user/sleeper-username',
      { sleeperUsername: value },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    return res.data
  }

  const handleLink = async () => {
    if (!input.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const data = await patchSleeperUsername(input.trim())
      dispatch(setSleeperUsername(data.sleeperUsername))
      dispatch(setSleeperUserId(data.sleeperUserId))
      setInput('')
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? 'Something went wrong')
      } else {
        setErrorMsg('Something went wrong')
      }
    }
  }

  const handleUnlink = async () => {
    setStatus('loading')
    setErrorMsg('')
    try {
      await patchSleeperUsername(null)
      dispatch(setSleeperUsername(null))
      dispatch(setSleeperUserId(null))
      setStatus('idle')
    } catch (err: unknown) {
      setStatus('error')
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? 'Failed to unlink account')
      } else {
        setErrorMsg('Failed to unlink account')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">← Dashboard</Link>
        <h1 className="text-xl font-bold">Account</h1>
      </nav>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* Left — Clerk UserProfile */}
          <div className="w-full lg:flex-1 min-w-0">
            <UserProfile
              routing="hash"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'rounded-xl border shadow-sm w-full',
                  navbar: 'hidden',
                  pageScrollBox: 'p-6',
                },
              }}
            />
          </div>

          {/* Right — Integrations */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect external platforms to power your dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sleeper */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">S</div>
                    <span className="text-sm font-medium">Sleeper</span>
                    {sleeperUsername && (
                      <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Connected</span>
                    )}
                  </div>

                  {sleeperUsername && (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-sm text-green-800">
                        <strong>{sleeperUsername}</strong>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={status === 'loading'}
                        onClick={handleUnlink}
                      >
                        Unlink
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLink()}
                      placeholder={sleeperUsername ? 'Change username' : 'Sleeper username'}
                      className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <Button
                      onClick={handleLink}
                      disabled={status === 'loading' || !input.trim()}
                      size="sm"
                    >
                      {status === 'loading' ? '…' : sleeperUsername ? 'Update' : 'Link'}
                    </Button>
                  </div>

                  {status === 'success' && (
                    <p className="text-xs text-green-600">Sleeper account linked!</p>
                  )}
                  {status === 'error' && (
                    <p className="text-xs text-red-500">{errorMsg}</p>
                  )}
                </div>

                {/* Future integrations placeholder */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-400">More integrations coming soon.</p>
                </div>
              </CardContent>
            </Card>

            {sleeperUsername && (
              <Card>
                <CardContent className="py-4">
                  <Link to="/leagues" className="text-sm text-blue-600 hover:underline">
                    Manage synced leagues →
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
