const DEFAULT_COLORS = {
  primary: "#0f172a",
  secondary: "#1f2937",
  text: "#f8fafc",
};

const TEAM_COLORS = {
  "Arsenal": { primary: "#ef0107", secondary: "#ffffff" },
  "Aston Villa": { primary: "#95bfe5", secondary: "#670e36" },
  "Bournemouth": { primary: "#da291c", secondary: "#000000" },
  "Brentford": { primary: "#e30613", secondary: "#000000" },
  "Brighton & Hove Albion": { primary: "#0057b8", secondary: "#fdb913" },
  "Burnley": { primary: "#6c1d45", secondary: "#99d6ea" },
  "Chelsea": { primary: "#034694", secondary: "#ffffff" },
  "Crystal Palace": { primary: "#1b458f", secondary: "#c4122e" },
  "Everton": { primary: "#003399", secondary: "#f9a01b" },
  "Fulham": { primary: "#000000", secondary: "#cc0000" },
  "Liverpool": { primary: "#c8102e", secondary: "#0b5340" },
  "Luton Town": { primary: "#ee7c2b", secondary: "#1a2434" },
  "Manchester City": { primary: "#6cabdd", secondary: "#1c2c5b" },
  "Manchester United": { primary: "#ef0107", secondary: "#ffcb05" },
  "Newcastle United": { primary: "#000000", secondary: "#b4975a" },
  "Nottingham Forest": { primary: "#e32227", secondary: "#ffffff" },
  "Sunderland": { primary: "#ef0107", secondary: "#000000" },
  "Sheffield United": { primary: "#ee2737", secondary: "#000000" },
  "Tottenham Hotspur": { primary: "#132257", secondary: "#c6ced8" },
  "West Ham United": { primary: "#7a263a", secondary: "#1bb1e7" },
  "Wolverhampton Wanderers": { primary: "#fdb913", secondary: "#231f20" },
  "FootySocial Hub": { primary: "#0ea5e9", secondary: "#0f172a" },
};

const ensureHex = (color) => {
  if (!color) return null;
  return color.startsWith("#") ? color : `#${color}`;
};

const getLuminance = (hex) => {
  const normalized = ensureHex(hex);
  if (!normalized || normalized.length !== 7) {
    return 0;
  }
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;

  const transform = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [lr, lg, lb] = [transform(r), transform(g), transform(b)];

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

const pickTextColor = (baseHex) => {
  const luminance = getLuminance(baseHex);
  return luminance > 0.55 ? "#0f172a" : "#f8fafc";
};

export function getTeamColors(teamName) {
  const normalized = (teamName || "").trim().toLowerCase();
  const matchedEntry = Object.entries(TEAM_COLORS).find(([name]) => name.toLowerCase() === normalized);
  const palette = matchedEntry ? matchedEntry[1] : DEFAULT_COLORS;

  const primary = ensureHex(palette.primary) || DEFAULT_COLORS.primary;
  const secondary = ensureHex(palette.secondary) || primary;
  const text = palette.text || pickTextColor(primary);

  return { primary, secondary, text };
}

export function getFanRoomBackground(teamName) {
  const { primary, secondary } = getTeamColors(teamName);
  return `linear-gradient(180deg, ${primary} 0%, ${secondary} 55%, ${primary} 100%)`;
}
