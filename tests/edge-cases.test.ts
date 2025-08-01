import { EventEmitter } from '../src/model';

describe('EventEmitter - Edge Cases', () => {
    interface TestEvents {
        test: string;
        numbers: number;
        objects: { value: string };
    }

    let emitter: EventEmitter<TestEvents>;

    beforeEach(() => {
        emitter = new EventEmitter<TestEvents>();
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle empty event data', () => {
            const listener = jest.fn();
            emitter.on('test', listener);

            emitter.emit('test', '');
            expect(listener).toHaveBeenCalledWith('');
        });

        test('should handle null/undefined in middleware', () => {
            const listener = jest.fn();

            emitter.middleware('test')
                .transform((data) => {
                    if (data === 'null') return null as any;
                    return data;
                });

            emitter.on('test', listener);

            emitter.emit('test', 'null');
            expect(listener).toHaveBeenCalledWith(null);
        });

        test('should handle middleware errors gracefully', () => {
            const listener = jest.fn();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            emitter.middleware('test')
                .transform(() => {
                    throw new Error('Middleware error');
                });

            emitter.on('test', listener);

            expect(() => emitter.emit('test', 'hello')).not.toThrow();
            expect(listener).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        test('should handle rapid fire events', () => {
            const listener = jest.fn();
            emitter.on('test', listener);

            for (let i = 0; i < 1000; i++) {
                emitter.emit('test', `message-${i}`);
            }

            expect(listener).toHaveBeenCalledTimes(1000);
        });

        test('should handle listeners that modify the emitter', () => {
            const listener1 = jest.fn(() => {
                emitter.off('test', listener2);
            });
            const listener2 = jest.fn();

            emitter.on('test', listener1);
            const id2 = emitter.on('test', listener2);

            emitter.emit('test', 'hello');

            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled(); // Should still be called since it was in the list

            // But should be removed for next emission
            emitter.emit('test', 'world');
            expect(listener2).toHaveBeenCalledTimes(1);
        });

        test('should handle very long middleware chains', () => {
            const listener = jest.fn();
            let chain = emitter.middleware('numbers');

            for (let i = 0; i < 100; i++) {
                chain = chain.transform((n: number) => n + 1);
            }

            emitter.on('numbers', listener);
            emitter.emit('numbers', 0);

            expect(listener).toHaveBeenCalledWith(100);
        });

        test('should handle concurrent async operations', async () => {
            const results: string[] = [];

            const promises = [
                emitter.once('test').then(data => results.push(`1:${data}`)),
                emitter.once('test').then(data => results.push(`2:${data}`)),
                emitter.once('test').then(data => results.push(`3:${data}`))
            ];

            setTimeout(() => emitter.emit('test', 'concurrent'), 10);

            await Promise.all(promises);

            expect(results).toHaveLength(3);
            expect(results).toContain('1:concurrent');
            expect(results).toContain('2:concurrent');
            expect(results).toContain('3:concurrent');
        });

        test('should handle memory pressure scenarios', () => {
            const ids: string[] = [];

            emitter.setMaxListeners(15000);

            for (let i = 0; i < 10000; i++) {
                const id = emitter.on('test', () => { });
                ids.push(id);
            }

            expect(emitter.listenerCount('test')).toBe(10000);

            for (let i = 0; i < 5000; i++) {
                emitter.off('test', ids[i]);
            }

            expect(emitter.listenerCount('test')).toBe(5000);

            emitter.removeAllListeners('test');
            expect(emitter.listenerCount('test')).toBe(0);
        });

        test('should handle AbortSignal that is already aborted', () => {
            const controller = new AbortController();
            controller.abort();

            const listener = jest.fn();
            emitter.on('test', listener, controller.signal);

            // The listener should not be added since signal is already aborted
            emitter.emit('test', 'hello');
            expect(listener).not.toHaveBeenCalled();
        });

        test('should handle deep object modifications in middleware', () => {
            const listener = jest.fn();

            emitter.middleware('objects')
                .transform((data) => {
                    return JSON.parse(JSON.stringify(data));
                })
                .transform((data) => {
                    data.modified = true;
                    return data;
                });

            emitter.on('objects', listener);

            const original = { value: 'test' };
            emitter.emit('objects', original);

            expect(listener).toHaveBeenCalledWith({ value: 'test', modified: true });
            expect(original).toEqual({ value: 'test' }); // Original should be unchanged
        });
    });
});
