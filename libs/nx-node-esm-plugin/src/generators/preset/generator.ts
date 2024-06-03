import { Tree, logger } from '@nx/devkit';
import { PresetGeneratorSchema } from './schema';
import sampleAppGenerator from '../sample-app/generator';
// import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';

export async function presetGenerator(
  tree: Tree,
  options: PresetGeneratorSchema
) {

  // TODO see determineProjectNameAndRootOptions() in Nx source

  logger.info(`NX Adding nx-node-esm-plugin sample app to workspace`);

  const result = await sampleAppGenerator(tree, {
    name: options.name,
  });

  return result;
}

export default presetGenerator;
