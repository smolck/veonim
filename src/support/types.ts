export type Unpacked<T> = T extends (infer U)[] ? U : T extends (...args: any[]) => infer U ? U : T extends Promise<infer U> ? U : T

export const maybe = <T>(val: T): T | undefined => val