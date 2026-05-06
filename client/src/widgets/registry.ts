import { lazy, type LazyExoticComponent } from 'react'

export interface WidgetDefinition {
  id: string
  name: string
  description: string
  component: LazyExoticComponent<() => JSX.Element>
  defaultSize: { w: number; h: number }
  tags: string[]
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
