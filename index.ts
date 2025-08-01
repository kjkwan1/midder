/**
 * Midder - type-safe EventEmitter with some modern niceties
 *
 * @packageDocumentation
 */

export { EventEmitter } from './src/model';
export { MiddlewareChain, MiddlewareBuilder } from './src/middleware';
export type { EventMap, EventData, MiddlewareHandler, FilterHandler, TapHandler } from './src/types';

import { EventEmitter } from './src/model';
export default EventEmitter;