import { ExecutorContext, ProjectGraphProjectNode, logger, normalizePath } from "@nx/devkit";
import { interpolate } from "nx/src/tasks-runner/utils";
import * as path from 'path';
import { dirname, join, relative } from "path";
import * as chalk from 'chalk';
import { fileExists } from "nx/src/utils/fileutils";

/**
 *
 * @param file
 * @param projectRoot
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/b9e190d22b03ca792fbd1a9665d3344167ccaf03/packages/js/src/utils/get-main-file-dir.ts#L4-L11
 */
export function getRelativeDirectoryToProjectRoot(
  file: string,
  projectRoot: string
): string {
  const dir = dirname(file);
  const relativeDir = normalizePath(relative(projectRoot, dir));
  return relativeDir === '' ? `./` : `./${relativeDir}/`;
}

/**
 *
 * @param context
 * @param project
 * @param buildOptions
 * @param buildTargetExecutor
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/b9e190d22b03ca792fbd1a9665d3344167ccaf03/packages/js/src/executors/node/node.impl.ts#L360C1-L425C2
 */
export function getFileToRun(
  context: ExecutorContext,
  project: ProjectGraphProjectNode,
  buildOptions: Record<string, any>,
  buildTargetExecutor: string
): string {
  // If using run-commands or another custom executor, then user should set
  // outputFileName, but we can try the default value that we use.
  if (!buildOptions?.outputPath && !buildOptions?.outputFileName) {
    // If we are using crystal for infering the target, we can use the output path from the target.
    // Since the output path has a token for the project name, we need to interpolate it.
    // {workspaceRoot}/dist/{projectRoot} -> dist/my-app
    const outputPath = project.data.targets[buildOptions.target]?.outputs?.[0];


    if (outputPath) {
      const outputFilePath = interpolate(outputPath, {
        projectName: project.name,
        projectRoot: project.data.root,
        workspaceRoot: '',
      });
      return path.join(outputFilePath, 'main.js');
    }
    const fallbackFile = path.join('dist', project.data.root, 'main.js');


    logger.warn(
      `Build option ${chalk.bold('outputFileName')} not set for ${chalk.bold(
        project.name
      )}. Using fallback value of ${chalk.bold(fallbackFile)}.`
    );
    return join(context.root, fallbackFile);
  }


  let outputFileName = buildOptions.outputFileName;


  if (!outputFileName) {
    const fileName = `${path.parse(buildOptions.main).name}.js`;
    if (
      buildTargetExecutor === '@nx/js:tsc' ||
      buildTargetExecutor === '@nx/js:swc'
    ) {
      outputFileName = path.join(
        getRelativeDirectoryToProjectRoot(buildOptions.main, project.data.root),
        fileName
      );
    } else {
      outputFileName = fileName;
    }
  }


  return join(context.root, buildOptions.outputPath, outputFileName);
}

/**
 *
 * @param fileToRun
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/b9e190d22b03ca792fbd1a9665d3344167ccaf03/packages/js/src/executors/node/node.impl.ts#L412-L425
 */
export function fileToRunCorrectPath(fileToRun: string): string {
  if (fileExists(fileToRun)) return fileToRun;


  // const extensionsToTry = ['.cjs', '.mjs', '.cjs.js', '.esm.js'];
  const extensionsToTry = ['.mjs', '.esm.js', '.cjs', '.cjs.js']; // Prefer ESM


  for (const ext of extensionsToTry) {
    const file = fileToRun.replace(/\.js$/, ext);
    if (fileExists(file)) return file;
  }


  throw new Error(
    `Could not find ${fileToRun}. Make sure your build succeeded.`
  );
}
