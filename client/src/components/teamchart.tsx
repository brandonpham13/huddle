import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import axios from 'axios';

import getTeamId from '../services/getTeamId';  

// Register the necessary components of Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface StatData {
  week: number;
  statValue: number;
}

const StatChart = ({ teamAbbreviation }: { teamAbbreviation: string }) => {
  const [selectedStat, setSelectedStat] = useState<string>('netPassingYards'); // Default stat to display
  const [data, setData] = useState<StatData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Step 2: Use team id to retrieve game ids
  const getGameIds = async (teamId: string): Promise<string[] | null> => {
    const API_URL = 'https://nfl-api-data.p.rapidapi.com/nfl-team-schedule'

    try {
      const response = await axios.get(API_URL, {
        params: { id: teamId },
        headers: {
          'x-rapidapi-key': import.meta.env.VITE_RAPIDAPI_KEY,
          'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        },
      });
      const gameIds = response.data.events.map((event: any) => event.id);
      return gameIds;
    } catch (error) {
      console.error('Error fetching game IDs:', error);
      return null;
    }
  };

  // TODO: account for bye weeks

  // Step 3: Fetch statistics for each game using the game ID
  const getGameStatistics = async (gameId: string): Promise<any> => {
    const API_URL = 'https://nfl-api-data.p.rapidapi.com/nfl-boxscore'

    try {
      const response = await axios.get(API_URL, {
        params: { id: gameId },
        headers: {
          'x-rapidapi-key': import.meta.env.VITE_RAPIDAPI_KEY || '',
          'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        },
      });

      const teams = response.data.boxscore.teams;

      let teamStats;
      let statValue;

      for (const key in teams) {
        if (teams[key].team.abbreviation === teamAbbreviation) {
            teamStats = teams[key].statistics;
            break;
            }
        }

      for (const stat in teamStats) {
        if (teamStats[stat].name === selectedStat) {
            statValue = teamStats[stat].displayValue;
            break;
            }
        }

      return statValue; // Fetch the relevant stat for the selected stat type
    } catch (error) {
      console.error('Error fetching game statistics:', error);
      return null;
    }
  };

  // Step 4: Fetch all the data: team ID -> game IDs -> statistics
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Step 1: Use the existing getTeamId function to get the team ID
      const teamId = await getTeamId(teamAbbreviation); // This uses the existing function you built
      if (!teamId) {
        console.error('Team not found');
        setLoading(false);
        return;
      }

      // Step 2: Get all game IDs for the team
      const gameIds = await getGameIds(teamId);
      if (!gameIds || gameIds.length === 0) {
        console.error('No games found for this team');
        setLoading(false);
        return;
      }

      // Step 3: Fetch statistics for each game using game IDs
      const statsPromises = gameIds.map((gameId) => getGameStatistics(gameId));
      const stats = await Promise.all(statsPromises);

      // Format the data for chart (assuming stats return week number and stat value)
      const formattedData = stats.map((stat, index) => ({
        week: index + 1, // Assuming the stats come in the same order as the weeks
        statValue: stat || 0, // Default to 0 if no data is found
      }));

      setData(formattedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [teamAbbreviation, selectedStat]);

  const chartData = {
    labels: data.map((entry) => `Week ${entry.week}`),
    datasets: [
      {
        label: `${selectedStat} (Yards)`,
        data: data.map((entry) => entry.statValue),
        borderColor: 'rgba(75,192,192,1)',
        backgroundColor: 'rgba(75,192,192,0.2)',
        fill: true,
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: `${selectedStat.charAt(0).toUpperCase() + selectedStat.slice(1)} for ${teamAbbreviation} (Week Over Week)`,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Weeks',
        },
      },
      y: {
        title: {
          display: true,
          text: `${selectedStat.charAt(0).toUpperCase() + selectedStat.slice(1)} (Yards)`,
        },
        min: 0,
      },
    },
  };

  return (
    <div>
      <h1>Team Statistics: {selectedStat.charAt(0).toUpperCase() + selectedStat.slice(1)}</h1>
      <select value={selectedStat} onChange={(e) => setSelectedStat(e.target.value)}>
        <option value="netPassingYards">Passing Yards</option>
        <option value="rushingYards">Rushing Yards</option>
        <option value="totalYards">Total Yards</option>
      </select>

      {loading ? <div>Loading...</div> : <Line data={chartData} options={chartOptions} />}
    </div>
  );
};

export default StatChart;
