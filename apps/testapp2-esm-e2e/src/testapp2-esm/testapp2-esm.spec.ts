import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execP = promisify(exec);

describe('testapp2-esm tests', () => {

  it('should work correctly with @harves/nx-node-esm-plugin:node executor', () => {
    const output = execSync(`./node_modules/.bin/nx run testapp2-esm:test-node-esm-plugin`).toString();
    expect(output).toMatch(/TEST testapp2-esm: [^ ]+, testlib1-commonjs, testlib2-esm/);
  });

  it('should fail with @nx/js:node executor', async () => {
    expect.assertions(1);

    await expect(async () => {
      const { stdout, stderr } = await execP(`./node_modules/.bin/nx run testapp2-esm:test-js-node`);
    }).rejects.toThrow(/Cannot find package '[^']+' imported from .+testapp2-esm/);
  });
});
