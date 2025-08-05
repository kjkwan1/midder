import { EventEmitter } from "./model";

interface TestEventMap {
    'userAction': { userId: string; action: string };
    'dataUpdate': { id: number; value: string };
}

function spacer() {
    console.log('----------------------------------------');
}

function title(text: string) {
    console.log(`\n=== ${text} ===`);
}

function subtitle(text: string) {
    console.log(`\n-- ${text} --`);
}

function emitterLog(text: string) {
    console.log(`[Emitter]: ${text}`);
}

function idLog(id: string, text: string) {
    console.log(`[ID: ${id}]: ${text}`);
}

function resetEmitter(emitter: EventEmitter<any>) {
    emitter.removeAllListeners();
    emitter.removeAllOperations();
}

async function runTests() {

    spacer();
    title('Basic event emitter functionality example');
    const emitter = new EventEmitter<TestEventMap>();
    emitter.on('userAction', (data) => {
        emitterLog(`User ${data.userId} performed action: ${data.action}`);
    });
    subtitle('Emitting userAction event');
    emitter.emit('userAction', { userId: '123', action: 'login' });

    resetEmitter(emitter);
    spacer();

    title('ID based event emission example');
    const id1 = emitter.on('dataUpdate', (data) => {
        idLog('ID1', `Data updated: ${data.id} = ${data.value}`);
    });
    const id2 = emitter.on('dataUpdate', (data) => {
        idLog('ID2', `Data updated: ${data.id} = ${data.value}`);
    });
    subtitle(`Created listeners with IDs: ${id1}, ${id2}`);
    const id1TestData = { id: 1, value: 'test1' };
    const id2TestData = { id: 2, value: 'test2' };
    console.log('Emitting dataUpdate event to id1 listener');
    emitter.emitToListener('dataUpdate', id1TestData, id1);
    console.log('Emitting dataUpdate event to id2 listener');
    emitter.emitToListener('dataUpdate', id2TestData, id2);
    console.log('Removing ID1 listener');
    emitter.off('dataUpdate', id1);
    console.log('Emitting dataUpdate event to remaining listeners');
    emitter.emit('dataUpdate', { id: 3, value: 'test3' });
    console.log('Emitting dataUpdate event to ID1 listener (should not call)');
    emitter.emitToListener('dataUpdate', id1TestData, id1);
    console.log('Emitting dataUpdate event to ID2 listener (should call)');
    emitter.emitToListener('dataUpdate', id2TestData, id2);

    resetEmitter(emitter);
    spacer();

    title('Operation example');
    subtitle('Testing transform operation');
    emitter.operation('dataUpdate')
        .transform((data) => {
            emitterLog(`Transforming data: ${JSON.stringify(data)}`);
            return { ...data, value: data.value.toUpperCase() };
        });

    const initialData = { id: 3, value: 'hello' };
    emitter.on('dataUpdate', (data) => {
        emitterLog(`Transformed data received: ${data.id} = ${data.value}`);
    });

    emitter.emit('dataUpdate', initialData);

    resetEmitter(emitter);
    spacer();

    subtitle('Testing filter operation');
    let shouldFilter = false;
    emitter.operation('dataUpdate')
        .filter(() => shouldFilter);
    emitter.on('dataUpdate', (data) => {
        emitterLog(`Data received: ${data.id} = ${data.value}`);
    });
    console.log('Emitting dataUpdate event (should not be filtered)');
    emitter.emit('dataUpdate', { id: 4, value: 'test4' });
    shouldFilter = true;
    console.log('Emitting dataUpdate event (should be filtered)');
    emitter.emit('dataUpdate', { id: 5, value: 'test5' });
    resetEmitter(emitter);
    spacer();

    title('Testing wildcard');
    emitter.on('*', (event) => {
        emitterLog(`Wildcard listener received event: ${event.type} with data: ${JSON.stringify(event.data)}`);
    });
    emitter.on('userAction', (data) => {
        emitterLog(`User action event received: ${data.userId} - ${data.action}`);
    });
    emitter.on('dataUpdate', (data) => {
        emitterLog(`Data update event received: ${data.id} = ${data.value}`);
    });
    console.log('Emitting userAction event');
    emitter.emit('userAction', { userId: '456', action: 'logout' });
    console.log('Emitting dataUpdate event');
    emitter.emit('dataUpdate', { id: 6, value: 'test6' });
    resetEmitter(emitter);
    spacer();

    title('Testing AbortSignal and timeout');
    const controller = new AbortController();
    const signal = controller.signal;
    emitter.on('userAction', (data) => {
        emitterLog(`User action with AbortSignal: ${data.userId} - ${data.action}`);
    }, signal);
    console.log('Emitting userAction event with AbortSignal');
    emitter.emit('userAction', { userId: '789', action: 'delete' });
    console.log('Aborting signal');
    controller.abort();
    console.log('Emitting userAction event after abort (should not call listener)');
    emitter.emit('userAction', { userId: '789', action: 'update' });
}

runTests();