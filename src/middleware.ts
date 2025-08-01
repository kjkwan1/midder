import { EventEmitter } from "./model";
import { EventData, EventMap } from "./types";

interface MiddlewareStep<T, R = T> {
    type: 'transform' | 'filter' | 'tap';
    handler: (data: T) => R | boolean | void;
}

export class MiddlewareChain<T extends EventMap, K extends keyof T, CurrentType = EventData<T, K>> {
    constructor(
        private eventType: K,
        private steps: MiddlewareStep<any, any>[] = []
    ) { }

    transform<R>(handler: (data: CurrentType) => R): MiddlewareChain<T, K, R> {
        return new MiddlewareChain<T, K, R>(
            this.eventType,
            [...this.steps, { type: 'transform', handler }]
        );
    }

    filter(handler: (data: CurrentType) => boolean): MiddlewareChain<T, K, CurrentType> {
        return new MiddlewareChain<T, K, CurrentType>(
            this.eventType,
            [...this.steps, { type: 'filter', handler }]
        );
    }

    tap(handler: (data: CurrentType) => void): MiddlewareChain<T, K, CurrentType> {
        return new MiddlewareChain<T, K, CurrentType>(
            this.eventType,
            [...this.steps, { type: 'tap', handler }]
        );
    }

    log(message?: string): MiddlewareChain<T, K, CurrentType> {
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
                console.error(`Error in middleware step ${step.type}:`, error);
                if (step.type === 'transform') {
                    return undefined;
                }
            }
        }

        return result;
    }

    getSteps(): Readonly<MiddlewareStep<any, any>[]> {
        return this.steps;
    }

    compose<R>(otherChain: MiddlewareChain<T, K, R>): MiddlewareChain<T, K, R> {
        return new MiddlewareChain<T, K, R>(
            this.eventType,
            [...this.steps, ...otherChain.steps]
        );
    }
}

export class MiddlewareBuilder<Events extends EventMap, K extends keyof Events, CurrentType> {
    constructor(
        private emitter: EventEmitter<Events>,
        private event: K,
        private chain: MiddlewareChain<Events, K, CurrentType>
    ) { }

    transform<R>(handler: (data: CurrentType) => R): MiddlewareBuilder<Events, K, R> {
        const currentChain = this.emitter.getMiddleware(this.event) || this.chain;
        const newChain = currentChain.transform(handler);
        this.emitter.setMiddleware(this.event, newChain);
        return new MiddlewareBuilder<Events, K, R>(this.emitter, this.event, newChain);
    }

    filter(handler: (data: CurrentType) => boolean): MiddlewareBuilder<Events, K, CurrentType> {
        const currentChain = this.emitter.getMiddleware(this.event) || this.chain;
        const newChain = currentChain.filter(handler);
        this.emitter.setMiddleware(this.event, newChain);
        return new MiddlewareBuilder<Events, K, CurrentType>(this.emitter, this.event, newChain);
    }

    tap(handler: (data: CurrentType) => void): MiddlewareBuilder<Events, K, CurrentType> {
        const currentChain = this.emitter.getMiddleware(this.event) || this.chain;
        const newChain = currentChain.tap(handler);
        this.emitter.setMiddleware(this.event, newChain);
        return new MiddlewareBuilder<Events, K, CurrentType>(this.emitter, this.event, newChain);
    }

    log(message?: string): MiddlewareBuilder<Events, K, CurrentType> {
        const currentChain = this.emitter.getMiddleware(this.event) || this.chain;
        const newChain = currentChain.log(message);
        this.emitter.setMiddleware(this.event, newChain);
        return new MiddlewareBuilder<Events, K, CurrentType>(this.emitter, this.event, newChain);
    }
}