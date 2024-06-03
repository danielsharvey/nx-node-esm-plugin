import { NodeExecutorSchema } from './schema';
import executor from './executor';
import { ExecutorContext } from '@nx/devkit';
import { resolveFileToRunFromPackageJson } from './package-json-utils';

const options: NodeExecutorSchema = {
  buildTarget: 'build',
  _: [],
  __unparsed__: [],
};

describe('Node executor', () => {
  it('can resolve fileToRun from a package.json', async () => {

    const fileToRun = resolveFileToRunFromPackageJson(
      'libs/nx-node-esm-plugin/src/executors/node/__fixtures__'
    );
    expect(fileToRun).toBe(
      'libs/nx-node-esm-plugin/src/executors/node/__fixtures__/index.js'
    );

  });

  // performed as E2E test
  // it('can run', async () => {

  //   const context: ExecutorContext = {
  //     root: '/root',
  //     projectName: 'test',
  //     targetName: 'test',
  //     configurationName: 'development',
  //     cwd: '/tmp',
  //     isVerbose: false,
  //   };

  //   const output = await executor(options, context);
  //   expect(output.success).toBe(true);

  // });
});
