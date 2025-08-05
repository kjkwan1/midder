import { EventEmitter } from '../src/model';

describe('EventEmitter - Operations', () => {
    interface TestEvents {
        test: { value: number };
        string: string;
    }

    let emitter: EventEmitter<TestEvents>;

    beforeEach(() => {
        emitter = new EventEmitter<TestEvents>();
    });

    describe('transform operation', () => {
        test('should transform event data', () => {
            const listener = jest.fn();

            emitter.operation('test')
                .transform((data) => ({ ...data, transformed: true }));

            emitter.on('test', listener);
            emitter.emit('test', { value: 42 });

            expect(listener).toHaveBeenCalledWith({ value: 42, transformed: true });
        });

        test('should chain multiple transforms', () => {
            const listener = jest.fn();

            emitter.operation('test')
                .transform((data) => ({ ...data, step1: true }))
                .transform((data) => ({ ...data, step2: true }));

            emitter.on('test', listener);
            emitter.emit('test', { value: 42 });

            expect(listener).toHaveBeenCalledWith({
                value: 42,
                step1: true,
                step2: true
            });
        });
    });

    describe('filter operation', () => {
        test('should filter out events', () => {
            const listener = jest.fn();

            emitter.operation('test')
                .filter((data) => data.value > 10);

            emitter.on('test', listener);

            const result1 = emitter.emit('test', { value: 5 });
            const result2 = emitter.emit('test', { value: 15 });

            expect(result1).toBe(false); // Filtered out
            expect(result2).toBe(true);  // Passed through
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith({ value: 15 });
        });
    });

    describe('tap operation', () => {
        test('should execute side effects without modifying data', () => {
            const listener = jest.fn();
            const tapHandler = jest.fn();

            emitter.operation('test')
                .tap(tapHandler);

            emitter.on('test', listener);
            emitter.emit('test', { value: 42 });

            expect(tapHandler).toHaveBeenCalledWith({ value: 42 });
            expect(listener).toHaveBeenCalledWith({ value: 42 });
        });
    });

    describe('debounce operation', () => {
        test('should debounce event execution', () => {
            jest.useFakeTimers();
            const listener = jest.fn();

            emitter.operation('test')
                .debounce(100);

            emitter.on('test', listener);
            emitter.emit('test', { value: 42 });
            emitter.emit('test', { value: 43 });

            expect(listener).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(listener).toHaveBeenCalledWith({ value: 43 });

            jest.useRealTimers();
        });
    });

    describe('throttle operation', () => {
        test('should throttle event execution', () => {
            jest.useFakeTimers();
            const listener = jest.fn();

            emitter.operation('test')
                .throttle(100);

            emitter.on('test', listener);
            
            emitter.emit('test', { value: 1 });
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith({ value: 1 });

            emitter.emit('test', { value: 2 });
            emitter.emit('test', { value: 3 });
            expect(listener).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);
            emitter.emit('test', { value: 4 });
            expect(listener).toHaveBeenCalledTimes(2);
            expect(listener).toHaveBeenCalledWith({ value: 4 });

            jest.useRealTimers();
        });
    });

    describe('complex operation chains', () => {
        test('should execute operation in correct order', () => {
            const listener = jest.fn();
            const tapHandler1 = jest.fn();
            const tapHandler2 = jest.fn();

            emitter.operation('test')
                .tap(tapHandler1)
                .transform((data) => ({ ...data, transformed: true }))
                .filter((data) => data.value > 0)
                .tap(tapHandler2);

            emitter.on('test', listener);
            emitter.emit('test', { value: 42 });

            expect(tapHandler1).toHaveBeenCalledWith({ value: 42 });
            expect(tapHandler2).toHaveBeenCalledWith({ value: 42, transformed: true });
            expect(listener).toHaveBeenCalledWith({ value: 42, transformed: true });
        });

        test('should stop execution if filter fails', () => {
            const listener = jest.fn();
            const tapHandler = jest.fn();

            emitter.operation('test')
                .filter((data) => data.value > 50)
                .tap(tapHandler);

            emitter.on('test', listener);
            const result = emitter.emit('test', { value: 42 });

            expect(result).toBe(false);
            expect(tapHandler).not.toHaveBeenCalled();
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('wildcard events with operation', () => {
        test('should apply operation to wildcard listeners', () => {
            const wildcardListener = jest.fn();

            emitter.operation('test')
                .transform((data) => ({ ...data, transformed: true }));

            emitter.on('*', wildcardListener);
            emitter.emit('test', { value: 42 });

            expect(wildcardListener).toHaveBeenCalledWith({
                type: 'test',
                data: { value: 42, transformed: true }
            });
        });

        test('should filter wildcard events', () => {
            const wildcardListener = jest.fn();

            emitter.operation('test')
                .filter((data) => data.value > 50);

            emitter.on('*', wildcardListener);
            const result = emitter.emit('test', { value: 42 });

            expect(result).toBe(false);
            expect(wildcardListener).not.toHaveBeenCalled();
        });
    });

    describe('operation cleanup', () => {
        test('removeAllOperations() should clear operation', () => {
            const listener = jest.fn();

            emitter.operation('test')
                .transform((data) => ({ ...data, transformed: true }));

            emitter.removeAllOperations('test');

            emitter.on('test', listener);
            emitter.emit('test', { value: 42 });

            expect(listener).toHaveBeenCalledWith({ value: 42 });
        });
    });
});
