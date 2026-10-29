module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
    transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
    setupFiles: ['<rootDir>/scripts/jest-setup.cjs'],
    moduleNameMapper: { '\\.(css|svg)$': '<rootDir>/scripts/test-asset.cjs' },
};
