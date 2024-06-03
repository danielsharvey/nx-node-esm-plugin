import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  logger,
  names,
  readJson,
  Tree,
  updateJson,
  workspaceLayout,
} from '@nx/devkit';
import * as path from 'path';
import { SampleAppGeneratorSchema } from './schema';
import { libraryGenerator } from '@nx/js';
import { join } from 'path';

/**
 * Generate sample app containing ESM app calling buildable ESM lib,
 * demonstrating the use of the `@harves/nx-node-esm-plugin:node` executor.
 *
 * Includes targets running the app using Node, one with the
 * @nx/js:node executor which does not resolve the library import (fails),
 * and one with the @harves/nx-node-esm-plugin:node executor which does.
 *
 * @param tree
 * @param options
 */
export async function sampleAppGenerator(
  tree: Tree,
  options: SampleAppGeneratorSchema
) {
  const ws = workspaceLayout();
  const pkg = readJson(tree, 'package.json');
  const scope = pkg.name.split('/')[0];

  const appName = `${options.name}-app`;
  const appDirectory = `${ws.appsDir}/${options.name}-app`;

  const libName = `${options.name}-lib`;
  const libDirectory = `${ws.libsDir}/${options.name}-lib`;

  /*
   * create app
   */

  logger.info(`NX Generating sample app ${appDirectory}`);

  await libraryGenerator(
    tree, // virtual file system tree
    // options for the generator
    {
      name: appName,
      directory: appDirectory,
      projectNameAndRootFormat: 'as-provided',
      config: 'project',
      importPath: `${scope}/${appName}`,
      buildable: true,
      bundler: 'tsc',
      strict: true,
     }
  );

  // app Nx project
  updateJson(tree, join(appDirectory, 'project.json'), (projectJson) => {
    projectJson.projectType = 'application';
    projectJson.targets['run-js-node'] = {
      executor: '@nx/js:node',
      dependsOn: ['build'],
      options: {
        buildTarget: 'build',
        watch: false,
      },
    };
    projectJson.targets['run-node-esm-plugin'] = {
      executor: '@harves/nx-node-esm-plugin:node',
      dependsOn: ['build'],
      options: {
        buildTarget: 'build',
      },
    };
    return projectJson;
  });

  // app package.json
  updateJson(tree, join(appDirectory, 'package.json'), (pkgJson) => {
    pkgJson.type = 'module';
    return pkgJson;
  });

  // app tsconfig
  updateJson(tree, join(appDirectory, 'tsconfig.json'), (tsconfig) => {
    tsconfig.compilerOptions.module = 'esnext';
    return tsconfig;
  });

  /*
   * create library
   */

  logger.info(`NX Generating sample library ${libDirectory}`);

  await libraryGenerator(
    tree, // virtual file system tree
    // options for the generator
    {
      name: libName,
      directory: libDirectory,
      projectNameAndRootFormat: 'as-provided',
      config: 'project',
      importPath: `${scope}/${libName}`,
      buildable: true,
      bundler: 'tsc',
      strict: true,
     }
  );

  // library package.json
  updateJson(tree, join(libDirectory, 'package.json'), (pkgJson) => {
    pkgJson.type = 'module';
    return pkgJson;
  });

  // library tsconfig
  updateJson(tree, join(libDirectory, 'tsconfig.json'), (tsconfig) => {
    tsconfig.compilerOptions.module = 'esnext';
    return tsconfig;
  });

  // console.log('TREE', tree);

  // const projects = getProjects(tree);
  // console.log('OBJECT', Object.keys(projects));

  // const appConf = readProjectConfiguration(tree, appName);
  // appConf.projectType = 'application';
  // updateProjectConfiguration(tree, appName, appConf);

  /*
   * app + library source code
   */

  const appNames = names(appName);
  const libNames = names(libName);

  const substitutions = {
    appName,
    appNameFunc: appNames.propertyName,
    appNameFn: appNames.fileName,
    libName,
    libNameFunc: libNames.propertyName,
    libNameFn: libNames.fileName,
    libImport: `${scope}/${libName}`,
    tmpl: '',
  };

  generateFiles(tree, path.join(__dirname, 'files', 'app'), appDirectory, substitutions);
  generateFiles(tree, path.join(__dirname, 'files', 'lib'), libDirectory, substitutions);

  /*
   * app has dependency on library package
   */

  const libPkg = readJson(tree, join(libDirectory, 'package.json'));
  addDependenciesToPackageJson(
    tree,
    {
      [`${scope}/${libName}`]: libPkg.version,
    },
    {},
    join(appDirectory, 'package.json')
  );

  // const srcPath = `${appDirectory}/src/index.ts`;
  // const srcBuf = tree.read(srcPath);
  // const src = srcBuf.toString('utf-8');
  // console.log('SRC', src);

  // console.log('PKG', readJson(tree, join(appDirectory, 'package.json')));
  // console.log('PROJECT', JSON.stringify(readJson(tree, join(appDirectory, 'project.json')), null, 2));

  // console.log('TREE', tree);

  await formatFiles(tree);
}

export default sampleAppGenerator;
