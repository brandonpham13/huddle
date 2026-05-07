import { lazy, type LazyExoticComponent } from 'react'

export interface WidgetDefinition {
  id: string
  name: string
  description: string
  component: LazyExoticComponent<() => JSX.Element>
  /**
   * Grid layout on a 12-column grid.
   * w: 4 = 1/3, 6 = 1/2, 8 = 2/3, 12 = full width
   * h: row-span (1 = normal, 2 = double height)
   */
  defaultSize: { w: number; h: number }
  tags: string[]
  /** If true, widget renders on the main dashboard. Otherwise it lives on the /widgets page. */
  showOnDashboard: boolean
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

export function getDashboardWidgets(): WidgetDefinition[] {
  return Object.values(registry).filter(w => w.showOnDashboard)
}

export function getSecondaryWidgets(): WidgetDefinition[] {
  return Object.values(registry).filter(w => !w.showOnDashboard)
}

/** Maps defaultSize.w to a responsive Tailwind col-span class on a 12-col grid */
export function colSpanClass(w: number): string {
  const map: Record<number, string> = {
    1: 'col-span-12 md:col-span-1',
    2: 'col-span-12 md:col-span-2',
    3: 'col-span-12 md:col-span-3',
    4: 'col-span-12 md:col-span-6 lg:col-span-4',
    5: 'col-span-12 md:col-span-6 lg:col-span-5',
    6: 'col-span-12 md:col-span-6',
    7: 'col-span-12 lg:col-span-7',
    8: 'col-span-12 lg:col-span-8',
    9: 'col-span-12 lg:col-span-9',
    10: 'col-span-12 lg:col-span-10',
    11: 'col-span-12 lg:col-span-11',
    12: 'col-span-12',
  }
  return map[w] ?? 'col-span-12 md:col-span-6 lg:col-span-4'
}

/** Maps defaultSize.h to a Tailwind row-span class */
export function rowSpanClass(h: number): string {
  const map: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
  }
  return map[h] ?? 'row-span-1'
}
