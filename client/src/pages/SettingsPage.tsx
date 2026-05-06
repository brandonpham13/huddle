import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSleeperUsername } from '../store/slices/authSlice'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'

export function SettingsPage() {
  const { getToken } = useAuth()
  const dispatch = useAppDispatch()
  const sleeperUsername = useAppSelector(state => state.auth.user?.sleeperUsername)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const patchSleeperUsername = async (value: string | null) => {
    const token = await getToken()
    const res = await axios.patch(
      '/api/user/sleeper-username',
      { sleeperUsername: value },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    return res.data.sleeperUsername as string | null
  }

  const handleLink = async () => {
    if (!input.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const linked = await patchSleeperUsername(input.trim())
      dispatch(setSleeperUsername(linked))
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
        <h1 className="text-xl font-bold">Settings</h1>
      </nav>

      <main className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sleeper Account</CardTitle>
            <CardDescription>
              Link your Sleeper username to see your leagues and analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sleeperUsername && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm font-medium text-green-800">
                  Linked: <strong>{sleeperUsername}</strong>
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
                placeholder="Sleeper username"
                className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <Button onClick={handleLink} disabled={status === 'loading' || !input.trim()}>
                {status === 'loading' ? 'Saving…' : sleeperUsername ? 'Update' : 'Link'}
              </Button>
            </div>

            {status === 'success' && (
              <p className="text-sm text-green-600">Sleeper account linked!</p>
            )}
            {status === 'error' && (
              <p className="text-sm text-red-500">{errorMsg}</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
