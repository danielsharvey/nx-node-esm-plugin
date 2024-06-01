import { nodeRunner } from './node-runner';

describe('nodeRunner', () => {
  it('should work', () => {
    expect(nodeRunner()).toEqual('node-runner');
  });
});
