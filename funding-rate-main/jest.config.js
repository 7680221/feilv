module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?js$': 'babel-jest',
  },
  testMatch: [
    'app/exchanges/*.js',
    '!app/exchanges/__tests__/**',
  ],
  moduleFileExtensions: ['js', 'mjs'],
  transformIgnorePatterns: [
    '/node_modules/',
    '\\.pnp\\.[^\\/]+$'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'app/api/exchanges/*.js',
    '!app/api/exchanges/__tests__/**',
  ],
  setupFilesAfterEnv: [],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}; 