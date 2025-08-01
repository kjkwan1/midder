import { EventEmitter } from '../src/model';

describe('EventEmitter - Once and Async', () => {
    interface TestEvents {
        test: string;
        delayed: number;
    }

    let emitter: EventEmitter<TestEvents>;

    beforeEach(() => {
        emitter = new EventEmitter<TestEvents>();
    });

    describe('once()', () => {
        test('should resolve when event is emitted', async () => {
            setTimeout(() => {
                emitter.emit('test', 'hello');
            }, 10);

            const result = await emitter.once('test');
            expect(result).toBe('hello');
        });

        test('should remove listener after first emission', async () => {
            const promise = emitter.once('test');

            emitter.emit('test', 'first');
            emitter.emit('test', 'second');

            const result = await promise;
            expect(result).toBe('first');
        });

        test('should handle timeout', async () => {
            const promise = emitter.once('test', { timeout: 50 });

            await expect(promise).rejects.toThrow('Timeout after 50ms');
        });

        test('should handle AbortSignal', async () => {
            const controller = new AbortController();
            const promise = emitter.once('test', { signal: controller.signal });

            setTimeout(() => controller.abort(), 10);

            await expect(promise).rejects.toThrow('Operation aborted');
        });

        test('should resolve before timeout', async () => {
            const promise = emitter.once('test', { timeout: 100 });

            setTimeout(() => {
                emitter.emit('test', 'success');
            }, 10);

            const result = await promise;
            expect(result).toBe('success');
        });
    });

    describe('emitToListener()', () => {
        test('should emit to specific listener only', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            const id1 = emitter.on('test', listener1);
            const id2 = emitter.on('test', listener2);

            const result = emitter.emitToListener('test', 'hello', id1);

            expect(result).toBe(true);
            expect(listener1).toHaveBeenCalledWith('hello');
            expect(listener2).not.toHaveBeenCalled();
        });

        test('should return false for non-existent listener', () => {
            const result = emitter.emitToListener('test', 'hello', 'invalid-id');
            expect(result).toBe(false);
        });

        test('should apply middleware to targeted emission', () => {
            const listener = jest.fn();

            emitter.middleware('test')
                .transform((data: string) => data.toUpperCase());

            const id = emitter.on('test', listener);
            const result = emitter.emitToListener('test', 'hello', id);

            expect(result).toBe(true);
            expect(listener).toHaveBeenCalledWith('HELLO');
        });
    });
});
