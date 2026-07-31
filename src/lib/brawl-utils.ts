export const MODE_LABELS: Record<string, string> = {
  bounty: "Bounty", heist: "Heist", hotZone: "Hot Zone",
  brawlBall: "Brawl Ball", gemGrab: "Gem Grab", knockout: "Knockout",
};
export const MODE_EMOJI: Record<string, string> = {
  bounty: "🎯", heist: "💥", hotZone: "🔥", brawlBall: "⚽", gemGrab: "💎", knockout: "☠️",
};
export const MODE_COLOR: Record<string, string> = {
  bounty: "#f59e0b", heist: "#ef4444", hotZone: "#f97316",
  brawlBall: "#3b82f6", gemGrab: "#8b5cf6", knockout: "#ec4899",
};

export function displayName(name: string) {
  return name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
export function getBrawlerImg(brawlerName: string) {
  // brawlify borderless path by name — matches the working pattern in maps.tsx
  const slug = brawlerName.toLowerCase().replace(/[\s']/g, "-");
  return `https://cdn.brawlify.com/brawlers/borderless/${slug}.png`;
}
/** Alternative borderless URL using numeric ID (used for scrims where brawlerId is known) */
export function getBrawlerImgById(id: number) {
  return `https://cdn.brawlify.com/brawlers/borderless/${id}.png`;
}
export type ProTeamMeta = { name: string; code: string; logo: string };
export function findTeamLogo(name: string, code: string | null, teams: ProTeamMeta[]): string | null {
  const n = name.toLowerCase().trim();
  const c = code?.toLowerCase().trim();
  const byCode = c ? teams.find((t) => t.code.toLowerCase() === c) : undefined;
  if (byCode?.logo) return byCode.logo;
  const exact = teams.find((t) => t.name.toLowerCase() === n);
  if (exact?.logo) return exact.logo;
  const partial = teams.find((t) => n.length > 2 && (t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase())));
  return partial?.logo || null;
}
