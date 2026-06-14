const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  // Transform ESM modules from node_modules
  transformIgnorePatterns: [
    '/node_modules/(?!(@clerk)/)',
  ],
  // Collect coverage from all lib/types/hooks source files
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/types/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};

module.exports = createJestConfig(customJestConfig);
