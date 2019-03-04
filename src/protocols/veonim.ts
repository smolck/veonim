export enum MessageKind {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Success = 'success',
  System = 'system',
  Hidden = 'hidden',
}

export interface Message {
  kind: MessageKind
  message: string
  actions?: string[]
}

export interface FlexibleExpire {
  refresh(): void
}

// TODO: delet dis
export enum NotifyKind {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Success = 'success',
  System = 'system',
  Hidden = 'hidden',
}

// TODO: delet dis
export interface Notification {
  id: string
  kind: NotifyKind
  message: string
  count: number
  expire?: FlexibleExpire
  time: number
}
