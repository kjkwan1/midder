import { EventEmitter } from "./model";
import { EventData, EventMap } from "./types";

interface OperationStep<T, R = T> {
    type: 'transform' | 'filter' | 'tap';
    handler: (data: T) => R | boolean | void;
}

export class OperationChain<T extends EventMap, K extends keyof T, CurrentType = EventData<T, K>> {

    constructor(
        private eventType: K,
        private steps: OperationStep<any, any>[] = [],
    ) { }

    transform<R>(handler: (data: CurrentType) => R): OperationChain<T, K, R> {
        return new OperationChain<T, K, R>(
            this.eventType,
            [...this.steps, { type: 'transform', handler }]
        );
    }

    filter(handler: (data: CurrentType) => boolean): OperationChain<T, K, CurrentType> {
        return new OperationChain<T, K, CurrentType>(
            this.eventType,
            [...this.steps, { type: 'filter', handler }]
        );
    }

    tap(handler: (data: CurrentType) => void): OperationChain<T, K, CurrentType> {
        return new OperationChain<T, K, CurrentType>(
            this.eventType,
            [...this.steps, { type: 'tap', handler }]
        );
    }

    log(message?: string): OperationChain<T, K, CurrentType> {
        return this.tap((data) => console.log(message || `[${String(this.eventType)}]:`, data));
    }

    execute(eventData: EventData<T, K>): CurrentType | undefined {
        let result: any = eventData;

        for (const step of this.steps) {
            try {
                switch (step.type) {
                    case 'transform':
                        result = step.handler(result);
                        break;
                    case 'filter':
                        if (!step.handler(result)) {
                            return undefined;
                        }
                        break;
                    case 'tap':
                        step.handler(result);
                        break;
                }
            } catch (error) {
                console.error(`Error in operation step ${step.type}:`, error);
                if (step.type === 'transform') {
                    return undefined;
                }
            }
        }

        return result;
    }

    getSteps(): Readonly<OperationStep<any, any>[]> {
        return this.steps;
    }

    compose<R>(otherChain: OperationChain<T, K, R>): OperationChain<T, K, R> {
        return new OperationChain<T, K, R>(
            this.eventType,
            [...this.steps, ...otherChain.steps]
        );
    }
}

export class OperationChainBuilder<Events extends EventMap, K extends keyof Events, CurrentType> {

    constructor(
        private emitter: EventEmitter<Events>,
        private event: K,
        private chain: OperationChain<Events, K, CurrentType>
    ) { }

    transform<R>(handler: (data: CurrentType) => R): OperationChainBuilder<Events, K, R> {
        const currentChain = this.emitter.getOperation(this.event) || this.chain;
        const newChain = currentChain.transform(handler);
        this.emitter._setOperation(this.event, newChain);
        return new OperationChainBuilder<Events, K, R>(this.emitter, this.event, newChain);
    }

    filter(handler: (data: CurrentType) => boolean): OperationChainBuilder<Events, K, CurrentType> {
        const currentChain = this.emitter.getOperation(this.event) || this.chain;
        const newChain = currentChain.filter(handler);
        this.emitter._setOperation(this.event, newChain);
        return new OperationChainBuilder<Events, K, CurrentType>(this.emitter, this.event, newChain);
    }

    tap(handler: (data: CurrentType) => void): OperationChainBuilder<Events, K, CurrentType> {
        const currentChain = this.emitter.getOperation(this.event) || this.chain;
        const newChain = currentChain.tap(handler);
        this.emitter._setOperation(this.event, newChain);
        return new OperationChainBuilder<Events, K, CurrentType>(this.emitter, this.event, newChain);
    }

    debounce(delayMs: number): OperationChainBuilder<Events, K, CurrentType> {
        this.emitter._setDebounce(this.event, delayMs);
        return this;
    }

    throttle(delayMs: number): OperationChainBuilder<Events, K, CurrentType> {
        this.emitter._setThrottle(this.event, delayMs);
        return this;
    }

    log(message?: string): OperationChainBuilder<Events, K, CurrentType> {
        const currentChain = this.emitter.getOperation(this.event) || this.chain;
        const newChain = currentChain.log(message);
        this.emitter._setOperation(this.event, newChain);
        return new OperationChainBuilder<Events, K, CurrentType>(this.emitter, this.event, newChain);
    }
}