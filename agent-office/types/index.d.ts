export type Desk = { id: string; name: string; parentId: string; isWorking: boolean; doing: string; tokens: number }
export type Line = { from: string; to: string; text: string }
export type Gauge = { tokens: number; window: number; topeka: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-office': { desks: Shaped<Desk[]>; log: Shaped<Line[]>; gauge: Shaped<Gauge | null> }
  }
}
