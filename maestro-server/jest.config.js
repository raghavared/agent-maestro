module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  verbose: true,
  testTimeout: 10000,
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Maestro Server Test Report',
        outputPath: 'test-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
        sort: 'status',
        dateFormat: 'yyyy-mm-dd HH:MM:ss',
      }
    ]
  ],
};
