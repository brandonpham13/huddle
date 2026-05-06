import React from 'react';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  component: React.LazyExoticComponent<any>;
  defaultSize: { w: number; h: number };
  tags: string[];
}

const widgetRegistry: Record<string, WidgetDefinition> = {};

export function registerWidget(def: WidgetDefinition): void {
  widgetRegistry[def.id] = def;
}

export function getWidget(id: string): WidgetDefinition | undefined {
  return widgetRegistry[id];
}

export function getAllWidgets(): WidgetDefinition[] {
  return Object.values(widgetRegistry);
}
