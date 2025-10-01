let cache = null;

async function loadTeams() {
  if (cache) return cache;
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams');
    if (!res.ok) return (cache = []);
    const data = await res.json();
    const leagues = (((data || {}).sports || [])[0] || {}).leagues || [];
    const league = leagues[0] || {};
    const list = (league.teams || []).map((t) => t.team).filter(Boolean);
    cache = list.map((t) => ({
      id: t.id,
      name: (t.displayName || t.name || '').toLowerCase(),
      abbreviation: (t.abbreviation || '').toLowerCase(),
      logo: (t.logos && t.logos[0] && t.logos[0].href) || ''
    }));
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

export async function getTeamLogoUrlByName(teamName) {
  if (!teamName) return '';
  const teams = await loadTeams();
  const name = teamName.toLowerCase();
  const found = teams.find((t) => t.name === name || t.abbreviation === name);
  return found ? found.logo : '';
}


