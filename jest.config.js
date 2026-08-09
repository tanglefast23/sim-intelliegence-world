/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/{src,scripts}/**/__tests__/**/*.test.ts',
    '<rootDir>/{src,scripts}/**/__tests__/**/*.test.tsx',
  ],
  clearMocks: true,
};
