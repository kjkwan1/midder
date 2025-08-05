/**
 * Midder - type-safe EventEmitter with some modern niceties
 *
 * @packageDocumentation
 */

export { EventEmitter } from './src/model';
export { OperationChain, OperationChainBuilder } from './src/operation';
export type { EventMap, EventData, OperationHandler, FilterHandler, TapHandler } from './src/types';

import { EventEmitter } from './src/model';
export default EventEmitter;