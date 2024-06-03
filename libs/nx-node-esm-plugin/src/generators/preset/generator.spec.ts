import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { presetGenerator } from './generator';
import { PresetGeneratorSchema } from './schema';

describe('preset generator', () => {
  let tree: Tree;
  const options: PresetGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await presetGenerator(tree, options);
    const appConfig = readProjectConfiguration(tree, 'test-app');
    const libConfig = readProjectConfiguration(tree, 'test-lib');
    expect(appConfig).toBeDefined();
    expect(libConfig).toBeDefined();

  });
});
