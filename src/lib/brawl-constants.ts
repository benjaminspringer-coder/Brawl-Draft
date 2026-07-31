export const MAP_IMAGES: Record<string, string> = {
  "Hard Rock Mine": "https://static.wikia.nocookie.net/brawlstars/images/b/bf/Hard_Rock_Mine-Map.png/revision/latest",
  "Gem Fort": "https://static.wikia.nocookie.net/brawlstars/images/9/95/Gem_Fort-Map.png/revision/latest",
  "Crystal Arcade": "https://static.wikia.nocookie.net/brawlstars/images/0/06/Crystal_Arcade-Map.png/revision/latest",
  "Goldarm Gulch": "https://static.wikia.nocookie.net/brawlstars/images/3/3b/Goldarm_Gulch-Map.png/revision/latest",
  "New Horizons": "https://static.wikia.nocookie.net/brawlstars/images/5/5d/New_Horizons-Map.png/revision/latest",
  "Out in the Open": "https://static.wikia.nocookie.net/brawlstars/images/8/8c/Out_in_the_Open-Map.png/revision/latest",
  "Triple Dribble": "https://static.wikia.nocookie.net/brawlstars/images/e/e9/Triple_Dribble-Map.png/revision/latest",
  "Pinhole Punt": "https://static.wikia.nocookie.net/brawlstars/images/c/ca/Pinhole_Punt-Map.png/revision/latest",
  "Pinball Dreams": "https://static.wikia.nocookie.net/brawlstars/images/e/e9/Pinball_Dreams-Map.png/revision/latest",
  "Dry Season": "https://static.wikia.nocookie.net/brawlstars/images/3/3c/Dry_Season-Map.png/revision/latest",
  "Hideout": "https://static.wikia.nocookie.net/brawlstars/images/9/9d/Hideout-Map.png/revision/latest",
  "Layer Cake": "https://static.wikia.nocookie.net/brawlstars/images/a/af/Layer_Cake-Map.png/revision/latest",
  "Pit Stop": "https://static.wikia.nocookie.net/brawlstars/images/7/74/Pit_Stop-Map.png/revision/latest",
  "Safe Zone": "https://static.wikia.nocookie.net/brawlstars/images/a/ab/Safe_Zone-Map.png/revision/latest",
  "Kaboom Canyon": "https://static.wikia.nocookie.net/brawlstars/images/a/a5/Kaboom_Canyon-Map.png/revision/latest",
  "Ring of Fire": "https://static.wikia.nocookie.net/brawlstars/images/7/7a/Ring_of_Fire-Map.png/revision/latest",
  "Open Business": "https://static.wikia.nocookie.net/brawlstars/images/2/22/Open_Business-Map.png/revision/latest",
  "Dueling Beetles": "https://static.wikia.nocookie.net/brawlstars/images/5/51/Dueling_Beetles-Map.png/revision/latest",
};

export const MODE_ICONS: Record<string, string> = {
  bounty: "🎯", heist: "💥", hotZone: "🔥", brawlBall: "⚽", gemGrab: "💎", knockout: "☠️",
};

export const MODE_LABELS: Record<string, string> = {
  bounty: "Bounty", heist: "Heist", hotZone: "Hot Zone",
  brawlBall: "Brawl Ball", gemGrab: "Gem Grab", knockout: "Knockout",
};

export const MODE_COLORS: Record<string, string> = {
  bounty: "#f59e0b", heist: "#ef4444", hotZone: "#f97316",
  brawlBall: "#3b82f6", gemGrab: "#8b5cf6", knockout: "#ec4899",
};

export const MAP_TO_MODE: Record<string, string> = {
  "Goldarm Gulch": "knockout", "New Horizons": "knockout", "Out in the Open": "knockout",
  "Hard Rock Mine": "gemGrab", "Gem Fort": "gemGrab", "Crystal Arcade": "gemGrab",
  "Triple Dribble": "brawlBall", "Pinhole Punt": "brawlBall", "Pinball Dreams": "brawlBall",
  "Dry Season": "bounty", "Hideout": "bounty", "Layer Cake": "bounty",
  "Pit Stop": "heist", "Safe Zone": "heist", "Kaboom Canyon": "heist",
  "Ring of Fire": "hotZone", "Open Business": "hotZone", "Dueling Beetles": "hotZone",
};

export const BSC_MAPS: { mode: string; emoji: string; maps: string[] }[] = [
  { mode: "Knockout",   emoji: "☠️", maps: ["Goldarm Gulch", "New Horizons", "Out in the Open"] },
  { mode: "Gem Grab",   emoji: "💎", maps: ["Hard Rock Mine", "Gem Fort", "Crystal Arcade"] },
  { mode: "Brawl Ball", emoji: "⚽", maps: ["Triple Dribble", "Pinhole Punt", "Pinball Dreams"] },
  { mode: "Bounty",     emoji: "🎯", maps: ["Dry Season", "Hideout", "Layer Cake"] },
  { mode: "Heist",      emoji: "💥", maps: ["Pit Stop", "Safe Zone", "Kaboom Canyon"] },
  { mode: "Hot Zone",   emoji: "🔥", maps: ["Ring of Fire", "Open Business", "Dueling Beetles"] },
];

export function getBrawlerImg(name: string) {
  return `https://cdn.brawlify.com/brawler-bs/regular/${encodeURIComponent(name.toLowerCase().replace(/\s/g, "-"))}.png`;
}
export function getBrawlerImgById(id: number) {
  return `https://cdn.brawlify.com/brawlers/borderless/${id}.png`;
}

export function wrColor(wr: number, games = 99) {
  if (games < 3) return "text-white/40";
  return wr >= 60 ? "text-emerald-400" : wr >= 50 ? "text-yellow-400" : "text-red-400";
}
export function wrBgColor(wr: number) {
  return wr >= 60 ? "#22c55e" : wr >= 50 ? "#eab308" : "#ef4444";
}
