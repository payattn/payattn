export default {
  testEnvironment: 'jsdom',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
  collectCoverageFrom: [
    'llm-service.js',
    '!lib/snarkjs*.js', // Exclude bundled libraries
    '!lib/zk-prover.js', // Exclude - has duplicate declarations
    '!lib/witness-calculator-init.js', // Exclude WASM loader
    '!lib/max-assessor.js', // Exclude - browser-specific
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!*test*.js', // Exclude test files
    '!dummy-ads.js', // Exclude dummy data
    '!circuits/**',
    '!*.html', // Exclude HTML files
    '!ad-queue.js', // UI file
    '!background.js', // Needs refactoring
    '!content.js', // Content script
    '!crypto-utils.js', // Needs refactoring to export functions
    '!crypto.js', // Needs refactoring
    '!popup.js', // UI file
    '!profile.js', // UI file
    '!settings.js', // UI file  
    '!setup.js', // UI file
    '!venice-ai.js', // Needs refactoring
  ],
  coverageThreshold: {
    global: {
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
};
