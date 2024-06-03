import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { sampleAppGenerator } from './generator';
import { SampleAppGeneratorSchema } from './schema';

describe('Sample app generator', () => {
  let tree: Tree;
  const options: SampleAppGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await sampleAppGenerator(tree, options);
    const appConfig = readProjectConfiguration(tree, 'test-app');
    const libConfig = readProjectConfiguration(tree, 'test-lib');
    expect(appConfig).toBeDefined();
    expect(libConfig).toBeDefined();
  });
});
