import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execP = promisify(exec);

const successRe = /TEST testapp1-commonjs: [^ ]+, testlib1-commonjs, testlib2-esm/;

describe('testapp1-commonjs tests', () => {

  it('should fail with @nx/js:node executor', async () => {
    expect.assertions(1);

    await expect(async () => {
      const { stdout, stderr } = await execP(`npx nx run testapp1-commonjs:test-js-node`);
    }).rejects.toThrow(/Cannot find package '[^']+' imported from .+testapp1-commonjs/);
  });

  it('should work correctly with @harves/nx-node-esm-plugin:node executor (fileToRunMode===buildTarget)', () => {
    const output = execSync(`npx nx run testapp1-commonjs:test-node-esm-plugin-buildTarget-fileToRunMode`).toString();
    expect(output).toMatch(successRe);
  });

  it('should work correctly with @harves/nx-node-esm-plugin:node executor (fileToRunMode===specified)', () => {
    const output = execSync(`npx nx run testapp1-commonjs:test-node-esm-plugin-specified-fileToRunMode`).toString();
    expect(output).toMatch(successRe);
  });

  it('should work correctly with @harves/nx-node-esm-plugin:node executor (fileToRunMode===packageJson)', () => {
    const output = execSync(`npx nx run testapp1-commonjs:test-node-esm-plugin-packageJson-fileToRunMode`).toString();
    expect(output).toMatch(successRe);
  });

});
