let cache = null;

const ALIASES = {
  "man city": "manchester city",
  "manchester city": "manchester city",
  "man city fc": "manchester city",
  "man united": "manchester united",
  "man utd": "manchester united",
  "manchester united": "manchester united",
  "man u": "manchester united",
  "spurs": "tottenham hotspur",
  "tottenham": "tottenham hotspur",
  "tottenham hotspur": "tottenham hotspur",
  "wolves": "wolverhampton wanderers",
  "wolverhampton": "wolverhampton wanderers",
  "wolverhampton wanderers": "wolverhampton wanderers",
  "brighton": "brighton & hove albion",
  "brighton and hove": "brighton & hove albion",
  "brighton & hove albion": "brighton & hove albion",
  "newcastle": "newcastle united",
  "newcastle united": "newcastle united",
  "forest": "nottingham forest",
  "nottingham": "nottingham forest",
  "nottingham forest": "nottingham forest",
  "aston villa": "aston villa",
  "villa": "aston villa",
  "west brom": "west bromwich albion",
  "west bromwich": "west bromwich albion",
  "west bromwich albion": "west bromwich albion",
  "west ham": "west ham united",
  "west ham united": "west ham united",
  "chelsea fc": "chelsea",
  "chelsea": "chelsea",
  "arsenal fc": "arsenal",
  "arsenal": "arsenal",
  "liverpool": "liverpool",
  "liverpool fc": "liverpool",
  "fulham": "fulham",
  "brentford": "brentford",
  "everton": "everton",
  "burnley": "burnley",
  "bournemouth": "afc bournemouth",
  "afc bournemouth": "afc bournemouth",
  "crystal palace": "crystal palace",
  "palace": "crystal palace",
  "sheffield united": "sheffield united",
  "sheffield utd": "sheffield united",
  "ipswich": "ipswich town",
  "ipswich town": "ipswich town",
  "leicester": "leicester city",
  "leicester city": "leicester city"
};

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const normalized = normalizeName(teamName);
  const canonical = normalizeName(ALIASES[normalized] || normalized);
  const found = teams.find(
    (t) =>
      normalizeName(t.name) === canonical ||
      normalizeName(t.abbreviation) === canonical ||
      normalizeName(t.displayName || "") === canonical
  );
  return found ? found.logo : '';
}

