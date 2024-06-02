import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execP = promisify(exec);

describe('testapp1-commonjs tests', () => {

  it('should work correctly with @harves/nx-node-esm-plugin:node executor', () => {
    const output = execSync(`./node_modules/.bin/nx run testapp1-commonjs:test-node-esm-plugin`).toString();
    expect(output).toMatch(/TEST testapp1-commonjs: [^ ]+, testlib1-commonjs, testlib2-esm/);
  });

  it('should fail with @nx/js:node executor', async () => {
    expect.assertions(1);

    await expect(async () => {
      const { stdout, stderr } = await execP(`./node_modules/.bin/nx run testapp1-commonjs:test-js-node`);
    }).rejects.toThrow(/Cannot find package '[^']+' imported from .+testapp1-commonjs/);
  });
});
