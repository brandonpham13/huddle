import { lazy, type LazyExoticComponent } from 'react'

export interface WidgetDefinition {
  id: string
  name: string
  description: string
  component: LazyExoticComponent<() => JSX.Element>
  defaultSize: { w: number; h: number }
  tags: string[]
  /** Pinned widgets always render on the dashboard and cannot be removed by the user. */
  pinned?: boolean
}

const registry: Record<string, WidgetDefinition> = {}

export function registerWidget(def: WidgetDefinition) {
  registry[def.id] = def
}

export function getWidget(id: string): WidgetDefinition | undefined {
  return registry[id]
}

export function getAllWidgets(): WidgetDefinition[] {
  return Object.values(registry)
}

export function getPinnedWidgets(): WidgetDefinition[] {
  return Object.values(registry).filter(w => w.pinned)
}

export function getOptionalWidgets(): WidgetDefinition[] {
  return Object.values(registry).filter(w => !w.pinned)
}
