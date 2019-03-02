export enum NotifyKind {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Success = 'success',
  System = 'system',
  Hidden = 'hidden',
}

export interface Message {
  kind: NotifyKind
  message: string
  actions?: string[]
}

export interface FlexibleExpire {
  refresh(): void
}

export interface Notification {
  id: string
  kind: NotifyKind
  message: string
  count: number
  expire?: FlexibleExpire
  time: number
}
