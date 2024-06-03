import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execP = promisify(exec);

const successRe = /TEST testapp2-esm: [^ ]+, testlib1-commonjs, testlib2-esm/;

describe('testapp2-esm tests', () => {

  it('should fail with @nx/js:node executor', async () => {
    expect.assertions(1);

    await expect(async () => {
      const { stdout, stderr } = await execP(`npx nx run testapp2-esm:test-js-node`);
    }).rejects.toThrow(/Cannot find package '[^']+' imported from .+testapp2-esm/);
  });

  it('should work correctly with @harves/nx-node-esm-plugin:node executor (fileToRunMode===buildTarget)', () => {
    const output = execSync(`npx nx run testapp2-esm:test-node-esm-plugin-buildTarget-fileToRunMode`).toString();
    expect(output).toMatch(successRe);
  });

  it('should work correctly with @harves/nx-node-esm-plugin:node executor (fileToRunMode===specified)', () => {
    const output = execSync(`npx nx run testapp2-esm:test-node-esm-plugin-specified-fileToRunMode`).toString();
    expect(output).toMatch(successRe);
  });

  it('should work correctly with @harves/nx-node-esm-plugin:node executor (fileToRunMode===packageJson)', () => {
    const output = execSync(`npx nx run testapp2-esm:test-node-esm-plugin-packageJson-fileToRunMode`).toString();
    expect(output).toMatch(successRe);
  });
});
