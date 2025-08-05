import { OperationChainBuilder, OperationChain } from "./operation";
import { EventMap, EventData } from "./types";

type ListenerWithId<T> = { id: string; handler: (event: T) => void };

interface EventEmitterOptions {
    maxListeners?: number;
}

export class EventEmitter<Events extends EventMap = EventMap> {

    private maxListeners: number;
    private listeners = new Map<keyof Events, Set<ListenerWithId<any>>>();
    private wildcardListeners: ListenerWithId<any>[] = [];
    private operationChains = new Map<keyof Events, OperationChain<Events, any, any>>();
    private debounceTimers = new Map<keyof Events, NodeJS.Timeout>();
    private debounceDelays = new Map<keyof Events, number>();
    private throttleTimers = new Map<keyof Events, number>();
    private throttleDelays = new Map<keyof Events, number>();
    private idCounter = 0;

    constructor(config: EventEmitterOptions = { maxListeners: 10 }) {
        if (config.maxListeners && config.maxListeners < 0) {
            throw new Error('maxListeners cannot be negative');
        }
        this.maxListeners = config.maxListeners || 10;
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
    once<K extends keyof Events>(event: K & string, { timeout, signal }: { timeout?: number, signal?: AbortSignal } = {}): Promise<EventData<Events, K>> {
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
off<K extends string>(
        event: K | '*',
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
    operation<K extends keyof Events>(event: K): OperationChainBuilder<Events, K, EventData<Events, K>> {
        const existingChain = this.operationChains.get(event) || new OperationChain<Events, K>(event);
        return new OperationChainBuilder(this, event, existingChain);
    }

    emit<K extends keyof Events>(event: K, data: EventData<Events, K>): boolean {
        const debounceDelay = this.debounceDelays.get(event);
        const throttleDelay = this.throttleDelays.get(event);

        if (throttleDelay) {
            const currentTime = Date.now();
            const lastThrottleTime = this.throttleTimers.get(event);
            if (lastThrottleTime && currentTime - lastThrottleTime < throttleDelay) {
                return false;
            }
            this.throttleTimers.set(event, currentTime);
        }

        if (debounceDelay) {
            const existingTimer = this.debounceTimers.get(event);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const newTimer = setTimeout(() => {
                this.debounceTimers.delete(event);
                this._emitInternal(event, data);
            }, debounceDelay);

            this.debounceTimers.set(event, newTimer);
            return true;
        }

        return this._emitInternal(event, data);
    }

    private _emitInternal<K extends keyof Events>(event: K, data: EventData<Events, K>): boolean {
        let called = false;
        const listeners = this.listeners.get(event);
        const chain = this.operationChains.get(event);
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
     * Emit an event to a specific listener by ID, applying operations if available.
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

        const chain = this.operationChains.get(event);
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
            const timer = this.debounceTimers.get(event);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(event);
            }
            this.throttleTimers.delete(event);
        } else {
            this.listeners.clear();
            this.wildcardListeners = [];
            for (const timer of this.debounceTimers.values()) {
                clearTimeout(timer);
            }
            this.debounceTimers.clear();
            this.throttleTimers.clear();
        }
    }

    removeAllOperations<K extends keyof Events>(event?: K): void {
        if (event) {
            this.operationChains.delete(event);
            this.debounceDelays.delete(event);
            this.throttleDelays.delete(event);
            const timer = this.debounceTimers.get(event);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(event);
            }
            this.throttleTimers.delete(event);
        } else {
            this.operationChains.clear();
            this.debounceDelays.clear();
            this.throttleDelays.clear();
            for (const timer of this.debounceTimers.values()) {
                clearTimeout(timer);
            }
            this.debounceTimers.clear();
            this.throttleTimers.clear();
        }
    }

    eventNames(): (keyof Events)[] {
        return Array
            .from(this.listeners.keys())
            .filter((event) => (this.listeners.get(event)?.size || 0) > 0);
    }

    removeDebounce<K extends keyof Events>(event: K): void {
        this.debounceDelays.delete(event);
        const timer = this.debounceTimers.get(event);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(event);
        }
    }

    removeThrottle<K extends keyof Events>(event: K): void {
        this.throttleDelays.delete(event);
        this.throttleTimers.delete(event);
    }

    getOperation<K extends keyof Events>(event: K): OperationChain<Events, K, any> | undefined {
        return this.operationChains.get(event);
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

    /** @internal - Used by operation chain system, not intended for direct use */
    _setOperation<K extends keyof Events>(event: K, chain: OperationChain<Events, K, any>): void {
        this.operationChains.set(event, chain);
    }

    /** @internal - Used by operation chain system, not intended for direct use */
    _setDebounce<K extends keyof Events>(event: K, delayMs: number): void {
        this.debounceDelays.set(event, delayMs);
    }

    /** @internal - Used by operation chain system, not intended for direct use */
    _setThrottle<K extends keyof Events>(event: K, delayMs: number): void {
        this.throttleDelays.set(event, delayMs);
    }
}
