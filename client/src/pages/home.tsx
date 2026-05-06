import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { teams } from '../utils/teamList';

import StatChart from '../components/teamchart';


const HomePage = () => {
    const [teamAbbreviation, setTeamAbbreviation] = useState<string>('ARI');

    return (
        <div>
        <nav className="flex gap-4 p-2 border-b mb-4">
          <Link to="/" className="font-semibold text-blue-600 hover:underline">Home</Link>
          <Link to="/settings" className="font-semibold text-blue-600 hover:underline">Settings</Link>
        </nav>
        <h1>Welcome to the Home Page!</h1>
        <div>
            <label>Select Team: </label>
            <select value={teamAbbreviation} onChange={(e) => setTeamAbbreviation(e.target.value)}>
            {teams.map((team) => (
                <option key={team.abbreviation} value={team.abbreviation}>
                    ({team.abbreviation}) {team.name}
                </option>
            ))}
            </select>
        </div>

        <StatChart teamAbbreviation={teamAbbreviation} />
        </div>
    );
};

export default HomePage;
