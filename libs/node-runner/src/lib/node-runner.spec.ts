import { workspaceRoot } from '@nx/devkit';
import { fork } from 'child_process';
import { join } from 'path';

describe('nodeRunner', () => {
  it('should run Node script', async () => {
    expect.assertions(1);

    const result = await new Promise((res, rej) => {
      let stdout = '';
      const child = fork(
        join(workspaceRoot, 'dist/libs/node-runner/src/lib/node-runner.mjs'),
        [],
        {
          env: {
            NX_FILE_TO_RUN: join(
              workspaceRoot,
              'libs/node-runner/src/lib/__fixtures__/node-runner-test-script.js'
            ),
          },
          stdio: ['pipe', 'pipe', 'inherit', 'ipc'],
        }
      );
      child.stdout?.on('data', (data) => (stdout += data.toString()));
      child.on('error', (err) => rej(err));
      child.on('exit', (code) => {
        if (code === 0) res(stdout);
        else rej(new Error(`fork() failed with exit code ${code}`));
      });
    });
    expect(result).toMatch(/^node-runner-test-script/);
  });
});
