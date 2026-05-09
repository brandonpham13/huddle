import type { League } from "../types/fantasy";

/**
 * Builds a map from leagueId -> root ancestor leagueId by following
 * the previousLeagueRef chain. Two leagues with the same root are in
 * the same "family" (i.e. the same recurring league across seasons).
 */
export function buildFamilyRootMap(leagues: League[]): Map<string, string> {
  const parentMap = new Map<string, string>();
  for (const l of leagues) {
    if (l.previousLeagueRef) {
      parentMap.set(l.ref.leagueId, l.previousLeagueRef.leagueId);
    }
  }
  const cache = new Map<string, string>();
  function getRoot(id: string, visited = new Set<string>()): string {
    if (cache.has(id)) return cache.get(id)!;
    if (visited.has(id)) return id;
    visited.add(id);
    const parent = parentMap.get(id);
    const root = parent ? getRoot(parent, visited) : id;
    cache.set(id, root);
    return root;
  }
  const result = new Map<string, string>();
  for (const l of leagues) {
    result.set(l.ref.leagueId, getRoot(l.ref.leagueId));
  }
  return result;
}

/**
 * Returns the leagues in the same family as `leagueId`, sorted newest
 * season first. If `leagueId` isn't found in `leagues`, returns an empty array.
 */
export function getFamilySeasons(
  leagueId: string,
  leagues: League[],
): League[] {
  const rootMap = buildFamilyRootMap(leagues);
  const targetRoot = rootMap.get(leagueId);
  if (!targetRoot) return [];
  return leagues
    .filter((l) => rootMap.get(l.ref.leagueId) === targetRoot)
    .sort((a, b) => Number(b.season) - Number(a.season));
}
