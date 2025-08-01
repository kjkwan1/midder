export type EventMap = Record<string, any>;
export type EventData<T extends EventMap, K extends keyof T> = T[K];
export type MiddlewareHandler<T, R = T> = (data: T) => R;
export type FilterHandler<T> = (data: T) => boolean;
export type TapHandler<T> = (data: T) => void;
