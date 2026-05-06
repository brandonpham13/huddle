import axios from 'axios';

const API_URL = 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data';

const getTeamId = async (abbreviation: string): Promise<string | null> => {
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'x-rapidapi-key': import.meta.env.VITE_RAPIDAPI_KEY || '',
        'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
      },
    });

    // Find the team with the matching abbreviation
    const team = response.data.find((team: any) => team.team.abbreviation === abbreviation);

    if (team) {
      return team.team.id; // Return the team ID if the team is found
    } else {
      console.error('Team not found');
      return null;  // Return null if no team matches
    }
  } catch (error) {
    console.error('Error fetching team data:', error);
    return null;  // Return null in case of an error
  }
};

export default getTeamId;
