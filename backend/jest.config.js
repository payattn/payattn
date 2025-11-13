module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/app'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/api/**/*.{ts,tsx}',
    '!lib/**/__tests__/**',
    '!app/api/__tests__/**',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!lib/zk/circuits-registry.ts',
    '!lib/zk/index.ts',
    '!lib/storage-examples.ts',
    '!lib/utils.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Increase timeout for crypto operations
  testTimeout: 10000,
};
