import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { setSleeperUsername } from '../store/slices/authSlice';
import type { RootState } from '../store';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const sleeperUsername = useSelector((state: RootState) => state.auth.user?.sleeperUsername ?? null);

  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLinkAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      const token = await getToken();
      const res = await axios.patch<{ sleeperUsername: string }>(
        '/api/user/sleeper-username',
        { sleeperUsername: inputValue.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      dispatch(setSleeperUsername(res.data.sleeperUsername));
      setStatus({ type: 'success', message: `Linked to @${res.data.sleeperUsername}` });
      setInputValue('');
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? (err.response.data as { error: string }).error
          : 'Something went wrong. Please try again.';
      setStatus({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sleeper Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sleeperUsername ? (
              <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3">
                <span className="text-sm font-medium text-green-800">
                  Linked as <strong>@{sleeperUsername}</strong>
                </span>
                <Button variant="outline" size="sm" disabled>
                  Unlink
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No Sleeper account linked yet.</p>
            )}

            <form onSubmit={handleLinkAccount} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Sleeper username"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !inputValue.trim()}>
                {loading ? 'Linking…' : 'Link Account'}
              </Button>
            </form>

            {status && (
              <p
                className={`text-sm ${
                  status.type === 'success' ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {status.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
