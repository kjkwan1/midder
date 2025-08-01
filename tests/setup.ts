// Jest setup file
// Add any global test configuration here

// Increase test timeout for async operations
jest.setTimeout(10000);

// Mock console.error to avoid noise in test output unless testing error handling
const originalConsoleError = console.error;
beforeEach(() => {
    console.error = jest.fn();
});

afterEach(() => {
    console.error = originalConsoleError;
});
