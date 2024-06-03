/* eslint-disable */
export default {
  displayName: 'node-runner',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['mts', 'ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/node-runner',
};
