import {
  ExecutorContext,
  ProjectGraphProjectNode,
  Target,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
  targetToTargetString,
} from '@nx/devkit';
import { NodeExecutorSchema } from './schema';
import {
  calculateDependenciesFromTaskGraph,
  calculateProjectDependencies,
} from './buildable-libs-utils';
import { fileToRunCorrectPath, getFileToRun } from './node-utils';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph';
import * as chalk from 'chalk';
import { calculateCwd, createProcess } from './run-commands-utils';
import { interpolate } from 'nx/src/tasks-runner/utils';
import { join, relative, resolve } from 'path';
import { statSync } from 'fs';

/**
 * Build the node-runner library; this is only necessary during
 * development (building off source).
 *
 * @param context
 */
async function performNodeRunnerLibBuild(context: ExecutorContext) {
  for await (const output of await runExecutor<{
    success: boolean;
  }>(
    { project: 'node-runner', target: 'build', configuration: 'production' },
    {
      // watch: opts.watch,
    },
    context
  )) {
    if (!output.success) {
      throw new Error('Could not compile node-runner library');
    }
  }
}

function fileExists(pth: string) {
  return statSync(pth, { throwIfNoEntry: false })?.isFile() ?? false;
}

export default async function _runExecutor(
  options: NodeExecutorSchema,
  context: ExecutorContext
) {
  console.log('OPT', options);

  const target = parseTargetString(context.targetName, context);
  const buildTarget = parseTargetString(options.buildTarget, context);

  /*
   * Two parts :

   * 1. Dependencies - collect libs from task graph.
   *
   * 2. File to run; options
   *    - `fileToRunMode` === `packageJson`
   *    - `fileToRunMode` === `specified` via `fileToRun` property
   *    - `fileToRunMode` === `fromBuildTarget` via `getFileToRun()` as per `@nx/js:node`
   */

  const taskGraph = createTaskGraph(
    context.projectGraph,
    {},
    [buildTarget.project],
    [buildTarget.target],
    buildTarget.configuration,
    {}
  );

  const deps = calculateDependenciesFromTaskGraph(
    taskGraph,
    context.projectGraph,
    context.root,
    buildTarget.project,
    buildTarget.target,
    buildTarget.configuration
  );

  const mappings: Record<string, string> = {};

  for (const d of deps.dependencies) {
    if (
      d.node.type === 'app' ||
      d.node.type === 'e2e' ||
      d.node.type === 'lib'
    ) {
      const project = context.projectGraph.nodes[d.node.name];
      const target: Target = {
        project: d.node.name,
        target: d.target,
        configuration: buildTarget.configuration,
      };

      const targetOptions = readTargetOptions(target, context);
      let outputPath =
        targetOptions.outputPath ??
        project.data.targets[d.target]?.outputs?.[0];
      if (outputPath) {
        outputPath = interpolate(outputPath, {
          projectName: project.name,
          projectRoot: project.data.root,
          workspaceRoot: '',
        });
        outputPath = join(context.root, outputPath);
      }

      mappings[d.name] = outputPath;
    }
  }

  if (Object.keys(mappings).length < 1) {
    logger.warn(
      `${targetToTargetString(target)}: buildTarget ${chalk.bold(
        targetToTargetString(buildTarget)
      )} has no dependencies. Is this correct?`
    );
  }

  // XXX TODO envFile

  let fileToRun: string;
  if(options.fileToRun) {

    fileToRun = options.fileToRun;
    fileToRun = fileToRun ? resolve(context.root, fileToRun) : fileToRun;
    if (!fileExists || !fileExists(fileToRun)) {
      logger.error(
        `File to run mode is 'specified' and bad fileToRun '${fileToRun}' was provided`
      );
      return { success: false };
    }
    if(options.fileToRunMode && options.fileToRunMode !== 'specified') {
      logger.warn(
        `A fileToRun was specified but fileToRunMode '${chalk.bold(
          options.fileToRunMode
        )}' as specifed (ignoring)`
      );
    }

  } else {

    if (
      options.fileToRunMode === 'fromBuildTarget' ||
      options.fileToRunMode === undefined
    ) {
      const project = context.projectGraph.nodes[buildTarget.project];
      const buildTargetExecutor =
        project.data.targets[buildTarget.target]?.executor;
      const buildOptions: Record<string, any> = {
        ...readTargetOptions(buildTarget, context),
        ...(options.buildTargetOptions ?? {}),
        target: buildTarget.target,
      };

      fileToRun = fileToRunCorrectPath(
        getFileToRun(context, project, buildOptions, buildTargetExecutor)
      );
    } else if (options.fileToRunMode === 'packageJson') {
      fileToRun = 'dummy';
    } else {
      logger.error(
        `File to run mode is 'specified' but no fileToRun was provided`
      );
    }
  }

  logger.info(`NX Running node script ${fileToRun}`);

  const relativeDirname = relative(context.root, __dirname);

  const nodeRunner =
    relativeDirname === 'libs/nx-node-esm-plugin/src/executors/node'
      ? join(context.root, 'dist/libs/node-runner/src/lib/node-runner.js')
      : join(__dirname, './node-runner/node-runner.js');

  if (relativeDirname === 'libs/nx-node-esm-plugin/src/executors/node') {
    await performNodeRunnerLibBuild(context);
  }

  const result = await createProcess(
    {
      command: nodeRunner,
      args: [...(options.args ?? []), ...(options.__unparsed__ ?? [])],
      // prefix: 'xx> ',
      // color: 'red',
    },
    options.color ?? true,
    calculateCwd(options.cwd, context),
    {
      ...(options.env ?? {}),
      NX_FILE_TO_RUN: fileToRun,
      NX_MAPPINGS: JSON.stringify(mappings),
      NX_MODULE_RESOLUTION_OVERRIDES: JSON.stringify(
        options.moduleResolutionOverrides ?? {}
      ),
    },
    true
  );

  return {
    success: result.success,
  };
}
