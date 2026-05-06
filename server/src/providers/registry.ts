import type { ProviderId } from '../domain/fantasy.js'
import type { FantasyProvider } from './types.js'
import { sleeperProvider } from './sleeper/index.js'

const providers: Partial<Record<ProviderId, FantasyProvider>> = {
  sleeper: sleeperProvider,
  // espn: future
  // yahoo: future
}

export function getProvider(id: string): FantasyProvider | null {
  return providers[id as ProviderId] ?? null
}

export function listProviderIds(): ProviderId[] {
  return Object.keys(providers) as ProviderId[]
}
