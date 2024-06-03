import {
  Tree,
} from '@nx/devkit';
import { PresetGeneratorSchema } from './schema';
import sampleAppGenerator from '../sample-app/generator';

export async function presetGenerator(
  tree: Tree,
  options: PresetGeneratorSchema
) {

  logger.info(`NX Adding nx-node-esm-plugin sample app to workspace`);

  await sampleAppGenerator(tree, {
    name: options.name,
  });
}

export default presetGenerator;
