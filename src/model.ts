import { MiddlewareBuilder, MiddlewareChain } from "./middleware";
import { EventMap, EventData } from "./types";

type ListenerWithId<T> = { id: string; handler: (event: T) => void };

interface EventEmitterOptions {
    maxListeners?: number;
}

export class EventEmitter<Events extends EventMap = EventMap> {

    private maxListeners: number;
    private listeners = new Map<keyof Events, Set<ListenerWithId<any>>>();
    private wildcardListeners: ListenerWithId<any>[] = [];
    private middlewareChains = new Map<keyof Events, MiddlewareChain<Events, any, any>>();
    private idCounter = 0;

    constructor({ maxListeners = 10 }: EventEmitterOptions = {}) {
        if (maxListeners < 0) {
            throw new Error('maxListeners cannot be negative');
        }
        this.maxListeners = maxListeners;
    }

    /**
     * Subscribe to an event, and return a unique listener ID that can be used to target emissions or unsubscribe later.
     */
    on<K extends keyof Events>(
        event: K,
        listener: (event: EventData<Events, K>) => void,
        signal?: AbortSignal
    ): string;
    on<K extends '*'>(event: K,
        listener: (event: { type: keyof Events, data: Events[keyof Events] }) => void,
        signal?: AbortSignal
    ): string;
    on<K extends string>(
        event: string,
        listener: (event: EventData<Events, K>) => void,
        signal?: AbortSignal
    ): string {
        const id = `${this.idCounter++}`;
        
        if (signal?.aborted) {
            return id;
        }
        
        if (event === '*') {
            if (this.maxListeners > 0 && this.wildcardListeners.length >= this.maxListeners) {
                console.warn(`Max listeners exceeded for wildcard event`);
            }
        } else {
            if (this.maxListeners > 0 && this.listenerCount(event as keyof Events) >= this.maxListeners) {
                console.warn(`Max listeners exceeded for event: ${event}`);
            }
        }

        const listenerWithId: ListenerWithId<EventData<Events, K>> = { id, handler: listener };

        if (event === '*') {
            this.wildcardListeners.push(listenerWithId);
            if (signal) {
                signal.addEventListener('abort', () => this.off(event, id));
            }
            return id;
        }

        const existingListeners = this.listeners.get(event) || new Set();
        existingListeners.add(listenerWithId);
        this.listeners.set(event, existingListeners);

        if (signal) {
            signal.addEventListener('abort', () => this.off(event, id));
        }

        return id;
    }

    /**
     * Promise based event listener that resolves with the result of one event emission with automatic cleanup.
     */
    once<K extends keyof Events>(event: K, { timeout, signal }: { timeout?: number, signal?: AbortSignal } = {}): Promise<EventData<Events, K>> {
        return new Promise((resolve, reject) => {
            let id: string;
            let timeoutId: NodeJS.Timeout | number | undefined;
            
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                this.off(event, id);
            };

            const wrappedListener = (data: EventData<Events, K>) => {
                cleanup();
                resolve(data);
            };
            
            id = this.on(event, wrappedListener);

            if (timeout && timeout > 0) {
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error(`Timeout after ${timeout}ms`));
                }, timeout);
            }
            
            if (signal) {
                signal.addEventListener('abort', () => {
                    cleanup();
                    reject(new Error('Operation aborted'));
                });
            }
        });
    }

    /**
     * Unsubscribe from an event or wildcard listeners
     */
    off<K extends '*'>(
        event: K,
        idOrHandler: string | ((event: EventData<Events, K>) => void)
    ): boolean;
    off<K extends keyof Events>(
        event: K,
        idOrHandler: string | ((event: EventData<Events, K>) => void)
    ): boolean;
    off<K extends string>(
        event: K,
        idOrHandler: string | ((event: EventData<Events, K>) => void)
    ): boolean {
        if (event === '*') {
            const before = this.wildcardListeners.length;
            this.wildcardListeners = typeof idOrHandler === 'string'
                ? this.wildcardListeners.filter((l) => l.id !== idOrHandler)
                : this.wildcardListeners.filter((l) => l.handler !== idOrHandler);
            return this.wildcardListeners.length !== before;
        }

        const listeners = this.listeners.get(event);
        if (!listeners) {
            return false;
        }

        const filtered = typeof idOrHandler === 'string'
            ? Array.from(listeners).filter((listener) => listener.id !== idOrHandler)
            : Array.from(listeners).filter((listener) => listener.handler !== idOrHandler);

        if (filtered.length === listeners.size) {
            return false;
        }

        this.listeners.set(event, new Set(filtered));
        return true;
    }

    /**
     * Apply transformation, filtering, and tap handlers to specific events.
     */
    middleware<K extends keyof Events>(event: K): MiddlewareBuilder<Events, K, EventData<Events, K>> {
        const existingChain = this.middlewareChains.get(event) || new MiddlewareChain<Events, K>(event);
        return new MiddlewareBuilder(this, event, existingChain);
    }

    emit<K extends keyof Events>(event: K, data: EventData<Events, K>): boolean {
        let called = false;
        const listeners = this.listeners.get(event);
        const chain = this.middlewareChains.get(event);
        if (!listeners && this.wildcardListeners.length === 0) {
            return false;
        }

        if (listeners && listeners.size > 0) {
            const processedData = chain ? chain.execute(data) : data;

            if (processedData === undefined) {
                return false;
            }

            const listenerArray = Array.from(listeners);
            for (const { handler } of listenerArray) {
                try {
                    handler(processedData);
                } catch (error) {
                    console.error(`Error in event listener for ${String(event)}:`, error);
                }
            }
            called = true;
        }

        for (const { handler } of this.wildcardListeners) {
            try {
                const wildcardData = chain ? chain.execute(data) : data;
                if (wildcardData !== undefined) {
                    handler({ type: event, data: wildcardData });
                    called = true;
                }
            } catch (error) {
                console.error(`Error in wildcard listener for ${String(event)}:`, error);
            }
        }

        return called;
    }

    /**
     * Emit an event to a specific listener by ID, applying middleware if available.
     * Returns true if the listener was called, false otherwise.
     */
    emitToListener<K extends keyof Events>(event: K, data: EventData<Events, K>, listenerId: string): boolean {
        const listeners = this.listeners.get(event);
        if (!listeners) {
            return false;
        }

        const targetListener = Array.from(listeners).find((listener) => listener.id === listenerId);
        if (!targetListener) {
            return false;
        }

        const chain = this.middlewareChains.get(event);
        const processedData = chain ? chain.execute(data) : data;

        if (processedData === undefined) {
            return false;
        }

        try {
            targetListener.handler(processedData);
            return true;
        } catch (error) {
            console.error(`Error in specific listener ${listenerId} for ${String(event)}:`, error);
            return false;
        }
    }
    
    listenerCount<K extends keyof Events>(event: K | '*'): number {
        if (event === '*') {
            return this.wildcardListeners.length;
        }
        return this.listeners.get(event)?.size || 0;
    }

    removeAllListeners<K extends keyof Events>(event?: K): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
            this.wildcardListeners = [];
        }
    }

    removeAllMiddleware<K extends keyof Events>(event?: K): void {
        if (event) {
            this.middlewareChains.delete(event);
        } else {
            this.middlewareChains.clear();
        }
    }

    eventNames(): (keyof Events)[] {
        return Array
            .from(this.listeners.keys())
            .filter((event) => (this.listeners.get(event)?.size || 0) > 0);
    }

    setMiddleware<K extends keyof Events>(event: K, chain: MiddlewareChain<Events, K, any>): void {
        this.middlewareChains.set(event, chain);
    }

    getMiddleware<K extends keyof Events>(event: K): MiddlewareChain<Events, K, any> | undefined {
        return this.middlewareChains.get(event);
    }

    getMaxListeners(): number {
        return this.maxListeners;
    }

    setMaxListeners(n: number): this {
        if (n < 0) {
            throw new Error('maxListeners cannot be negative');
        }
        this.maxListeners = n;
        return this;
    }
}
