import React, { lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { registerWidget } from '../registry';
import { meta } from './meta';

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  status: string;
}

const PLACEHOLDER_USERNAME = 'placeholder_user';
const CURRENT_YEAR = new Date().getFullYear().toString();

async function fetchLeagues(username: string, year: string): Promise<SleeperLeague[]> {
  const res = await fetch(`/api/sleeper/user/${username}/leagues/${year}`);
  if (!res.ok) throw new Error('Failed to fetch leagues');
  return res.json();
}

function LeagueStandingsWidget() {
  const { data: leagues, isLoading, isError, error } = useQuery<SleeperLeague[]>({
    queryKey: ['leagues', PLACEHOLDER_USERNAME, CURRENT_YEAR],
    queryFn: () => fetchLeagues(PLACEHOLDER_USERNAME, CURRENT_YEAR),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-red-500 text-sm">
            Error loading leagues: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>League Standings</CardTitle>
      </CardHeader>
      <CardContent>
        {!leagues || leagues.length === 0 ? (
          <p className="text-gray-500 text-sm">No leagues found for {CURRENT_YEAR}.</p>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase px-2">
              <span>League</span>
              <span className="text-center">Teams</span>
              <span className="text-right">Status</span>
            </div>
            {/* Data rows */}
            {leagues.map((league) => (
              <div
                key={league.league_id}
                className="grid grid-cols-3 items-center px-2 py-1.5 rounded-md hover:bg-gray-50 text-sm"
              >
                <span className="font-medium truncate">{league.name}</span>
                <span className="text-center text-gray-600">{league.total_rosters}</span>
                <span className="text-right text-gray-500 capitalize">{league.status}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Self-register
registerWidget({
  id: meta.id,
  name: meta.name,
  description: meta.description,
  component: lazy(() => Promise.resolve({ default: LeagueStandingsWidget })),
  defaultSize: meta.defaultSize,
  tags: meta.tags,
});

export default LeagueStandingsWidget;
