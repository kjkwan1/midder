# Midder

My take on EventEmitter that works in both browser and Node, with some enhancements

## Features

- **Type-Safe**: Full TypeScript support with strongly typed events
- **Middleware System**: Transform, filter, and tap into events with simple API
- **Universal**: Works in both Node.js and browsers
- **Targeted Emission**: Emit to specific listeners
- **Promise Support**: Await on once(), because it's annoying to do otherwise
- **AbortSignal**: Cancel listeners with standard web APIs
- **Wildcard Events**: Listen to all events with `*`

## Installation

```bash
npm install midder
```

## Building
```bash
npm run build
```

## Test
```bash
npm run test
```

## Example
```bash
npm run example
```

## Quick Start

```typescript
import { EventEmitter } from 'midder';

// Define your event types
interface MyEvents {
  userLogin: { userId: string; timestamp: number };
  dataUpdate: { id: string; value: any };
}

const emitter = new EventEmitter<MyEvents>();

// Add listeners
const listenerId = emitter.on('userLogin', (data) => {
  console.log(`User ${data.userId} logged in at ${data.timestamp}`);
});

// Emit events
emitter.emit('userLogin', {
  userId: 'user123',
  timestamp: Date.now()
});
```

## Middleware System

Transform and process events with powerful middleware:

```typescript
emitter.middleware('userLogin')
  .transform((data) => ({ ...data, processed: true }))
  .filter((data) => {
    console.log(data.processed);  // Type safe transformation
    return data.userId.length > 0;
  })
  .tap((data) => console.log('Processing:', data.userId))
  .log('User login processed');
```

## ID or reference based controls
```typescript
const emitter = new EventEmitter<EventMap>();
const id = emitter.on('data', (data) => {
    // ...
});

const callback = (data) => JSON.stringify(data);
emitter.on('data', callback);

// Targeted emissions based on ID (because why not)
emitter.emitToListener('data', { hello: 'world!' }, id);

// Both supported
emitter.off('data', id);
emitter.off('data', callback);

```

## Promise-based `once()`

```typescript
// Wait for next event
const userData = await emitter.once('userLogin');

// With timeout
const userData = await emitter.once('userLogin', { timeout: 5000 });

// With AbortSignal
const controller = new AbortController();
const userData = await emitter.once('userLogin', { signal: controller.signal });
```

## API Reference

### EventEmitter Methods

- `on(event, listener, signal?)` - Add event listener
- `off(event, idOrHandler)` - Remove event listener
- `once(event, options?)` - Promise-based single-use listener
- `emit(event, data)` - Emit event to all listeners
- `emitToListener(event, data, listenerId)` - Emit to specific listener
- `middleware(event)` - Get middleware builder for event
- `listenerCount(event)` - Get number of listeners
- `removeAllListeners(event?)` - Remove all listeners
- `eventNames()` - Get list of events with listeners

### Middleware Methods

- `transform(handler)` - Transform event data
- `filter(predicate)` - Filter events conditionally
- `tap(handler)` - Execute side effects
- `debounce(delayMs)` - Add debounce to events
- `throttle(delayMs)` - Add throttle to events
- `log(message?)` - Log events to console

## License

MIT © [kjkwan1]
