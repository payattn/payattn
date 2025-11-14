module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/app'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Skip tests that require Solana IDL (not available in CI)
    'settlement-service.test.ts',
    'solana-escrow.test.ts',
    'offers/\\[id\\]/accept/__tests__',
    'publisher/impressions/__tests__',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/api/**/*.{ts,tsx}',
    '!lib/**/__tests__/**',
    '!app/**/__tests__/**',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!lib/zk/circuits-registry.ts',
    '!lib/zk/index.ts',
    '!lib/storage-examples.ts',
    '!lib/utils.ts',
    // Exclude files that require Solana IDL (not available in CI)
    '!lib/solana-escrow.ts',
    '!lib/settlement-service.ts',
    '!app/api/advertiser/offers/[id]/accept/route.ts',
    '!app/api/publisher/impressions/route.ts',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 35,
      statements: 35
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Mock Solana IDL file that doesn't exist in CI
    '^.*/solana/payattn_escrow/target/idl/payattn_escrow.json$': '<rootDir>/jest.mock.idl.json'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Increase timeout for crypto operations
  testTimeout: 10000,
};
