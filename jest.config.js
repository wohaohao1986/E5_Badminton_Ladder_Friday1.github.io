module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/data/'],
  verbose: true,
  testTimeout: 10000
};
