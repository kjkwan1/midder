import { EventEmitter } from '../src/model';

describe('EventEmitter - Core Functionality', () => {
    interface TestEvents {
        test: string;
        data: { value: number };
        empty: void;
    }

    let emitter: EventEmitter<TestEvents>;

    beforeEach(() => {
        emitter = new EventEmitter<TestEvents>();
    });

    describe('on() and emit()', () => {
        test('should register and call listener', () => {
            const listener = jest.fn();
            emitter.on('test', listener);

            const result = emitter.emit('test', 'hello');

            expect(listener).toHaveBeenCalledWith('hello');
            expect(result).toBe(true);
        });

        test('should return unique listener IDs', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            const id1 = emitter.on('test', listener1);
            const id2 = emitter.on('test', listener2);

            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(typeof id2).toBe('string');
        });

        test('should call multiple listeners for same event', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            emitter.on('test', listener1);
            emitter.on('test', listener2);

            emitter.emit('test', 'hello');

            expect(listener1).toHaveBeenCalledWith('hello');
            expect(listener2).toHaveBeenCalledWith('hello');
        });

        test('should return false when no listeners', () => {
            const result = emitter.emit('test', 'hello');
            expect(result).toBe(false);
        });

        test('should handle listener errors gracefully', () => {
            const errorListener = jest.fn(() => {
                throw new Error('Test error');
            });
            const normalListener = jest.fn();

            emitter.on('test', errorListener);
            emitter.on('test', normalListener);

            const result = emitter.emit('test', 'hello');

            expect(result).toBe(true);
            expect(normalListener).toHaveBeenCalledWith('hello');
        });
    });

    describe('off()', () => {
        test('should remove listener by ID', () => {
            const listener = jest.fn();
            const id = emitter.on('test', listener);

            const removed = emitter.off('test', id);
            emitter.emit('test', 'hello');

            expect(removed).toBe(true);
            expect(listener).not.toHaveBeenCalled();
        });

        test('should remove listener by function reference', () => {
            const listener = jest.fn();
            emitter.on('test', listener);

            const removed = emitter.off('test', listener);
            emitter.emit('test', 'hello');

            expect(removed).toBe(true);
            expect(listener).not.toHaveBeenCalled();
        });

        test('should return false for non-existent listener', () => {
            const result = emitter.off('test', 'non-existent-id');
            expect(result).toBe(false);
        });

        test('should return false for non-existent event', () => {
            const listener = jest.fn();
            const result = emitter.off('test' as any, listener);
            expect(result).toBe(false);
        });
    });

    describe('Wildcard listeners', () => {
        test('should handle wildcard listeners', () => {
            const wildcardListener = jest.fn();
            emitter.on('*', wildcardListener);

            emitter.emit('test', 'hello');

            expect(wildcardListener).toHaveBeenCalledWith({
                type: 'test',
                data: 'hello'
            });
        });

        test('should remove wildcard listeners', () => {
            const wildcardListener = jest.fn();
            const id = emitter.on('*', wildcardListener);

            const removed = emitter.off('*', id);
            emitter.emit('test', 'hello');

            expect(removed).toBe(true);
            expect(wildcardListener).not.toHaveBeenCalled();
        });

        test('should call both specific and wildcard listeners', () => {
            const specificListener = jest.fn();
            const wildcardListener = jest.fn();

            emitter.on('test', specificListener);
            emitter.on('*', wildcardListener);

            emitter.emit('test', 'hello');

            expect(specificListener).toHaveBeenCalledWith('hello');
            expect(wildcardListener).toHaveBeenCalledWith({
                type: 'test',
                data: 'hello'
            });
        });
    });

    describe('AbortSignal support', () => {
        test('should auto-remove listener when signal is aborted', () => {
            const controller = new AbortController();
            const listener = jest.fn();

            emitter.on('test', listener, controller.signal);
            controller.abort();

            emitter.emit('test', 'hello');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('Utility methods', () => {
        test('listenerCount() should return correct count', () => {
            expect(emitter.listenerCount('test')).toBe(0);

            emitter.on('test', jest.fn());
            emitter.on('test', jest.fn());

            expect(emitter.listenerCount('test')).toBe(2);
        });

        test('eventNames() should return active events', () => {
            expect(emitter.eventNames()).toEqual([]);

            emitter.on('test', jest.fn());
            emitter.on('data', jest.fn());

            expect(emitter.eventNames()).toContain('test');
            expect(emitter.eventNames()).toContain('data');
        });

        test('removeAllListeners() should clear listeners', () => {
            emitter.on('test', jest.fn());
            emitter.on('data', jest.fn());

            emitter.removeAllListeners('test');

            expect(emitter.listenerCount('test')).toBe(0);
            expect(emitter.listenerCount('data')).toBe(1);

            emitter.removeAllListeners();
            expect(emitter.listenerCount('data')).toBe(0);
        });
    });
});
