import { join } from 'path';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
  TaskGraph,
  getOutputsForTargetAndConfiguration,
  parseTargetString,
} from '@nx/devkit';
import { fileExists, readJsonFile } from 'nx/src/utils/fileutils';

/**
 *
 * @param target
 * @param node
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/7f11a1d7d3f2e8a28fef50cdbbb6c4bfc25d6cf7/packages/js/src/utils/buildable-libs-utils.ts#L23C1-L29C2
 */
function isBuildable(target: string, node: ProjectGraphProjectNode): boolean {
  return (
    node.data.targets &&
    node.data.targets[target] &&
    node.data.targets[target].executor !== ''
  );
}

/**
 * @see https://github.com/nrwl/nx/blob/7f11a1d7d3f2e8a28fef50cdbbb6c4bfc25d6cf7/packages/js/src/utils/buildable-libs-utils.ts#L31C1-L35C3
 */
export type DependentBuildableProjectNode = {
  name: string;
  outputs: string[];
  node: ProjectGraphProjectNode | ProjectGraphExternalNode;
};

/**
 *
 * @param projGraph
 * @param root
 * @param projectName
 * @param targetName
 * @param configurationName
 * @param shallow
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/7f11a1d7d3f2e8a28fef50cdbbb6c4bfc25d6cf7/packages/js/src/utils/buildable-libs-utils.ts#L73C1-L164C2
 */
export function calculateProjectDependencies(
  projGraph: ProjectGraph,
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  shallow?: boolean
): {
  target: ProjectGraphProjectNode;
  dependencies: DependentBuildableProjectNode[];
  nonBuildableDependencies: string[];
  topLevelDependencies: DependentBuildableProjectNode[];
} {
  const target = projGraph.nodes[projectName];
  // gather the library dependencies
  const nonBuildableDependencies = [];
  const topLevelDependencies: DependentBuildableProjectNode[] = [];
  const collectedDeps = collectDependencies(
    projectName,
    projGraph,
    [],
    shallow
  );
  const missing = collectedDeps.reduce(
    (missing: string[] | undefined, { name: dep }) => {
      const depNode = projGraph.nodes[dep] || projGraph.externalNodes[dep];
      if (!depNode) {
        missing = missing || [];
        missing.push(dep);
      }
      return missing;
    },
    null
  );
  if (missing) {
    throw new Error(`Unable to find ${missing.join(', ')} in project graph.`);
  }
  const dependencies = collectedDeps
    .map(({ name: dep, isTopLevel }) => {
      let project: DependentBuildableProjectNode = null;
      const depNode = projGraph.nodes[dep] || projGraph.externalNodes[dep];
      if (depNode.type === 'lib') {
        if (isBuildable(targetName, depNode)) {
          const libPackageJsonPath = join(
            root,
            depNode.data.root,
            'package.json'
          );

          project = {
            name: fileExists(libPackageJsonPath)
              ? readJsonFile(libPackageJsonPath).name // i.e. @workspace/mylib
              : dep,
            outputs: getOutputsForTargetAndConfiguration(
              {
                project: projectName,
                target: targetName,
                configuration: configurationName,
              },
              {},
              depNode
            ),
            node: depNode,
          };
        } else {
          nonBuildableDependencies.push(dep);
        }
      } else if (depNode.type === 'npm') {
        project = {
          name: depNode.data.packageName,
          outputs: [],
          node: depNode,
        };
      }

      if (project && isTopLevel) {
        topLevelDependencies.push(project);
      }

      return project;
    })
    .filter((x) => !!x);

  dependencies.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

  return {
    target,
    dependencies,
    nonBuildableDependencies,
    topLevelDependencies,
  };
}

/**
 *
 * @param project
 * @param projGraph
 * @param acc
 * @param shallow
 * @param areTopLevelDeps
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/7f11a1d7d3f2e8a28fef50cdbbb6c4bfc25d6cf7/packages/js/src/utils/buildable-libs-utils.ts#L166C1-L194C2
 */
function collectDependencies(
  project: string,
  projGraph: ProjectGraph,
  acc: { name: string; isTopLevel: boolean }[],
  shallow?: boolean,
  areTopLevelDeps = true
): { name: string; isTopLevel: boolean }[] {
  (projGraph.dependencies[project] || []).forEach((dependency) => {
    const existingEntry = acc.find((dep) => dep.name === dependency.target);
    if (!existingEntry) {
      // Temporary skip this. Currently the set of external nodes is built from package.json, not lock file.
      // As a result, some nodes might be missing. This should not cause any issues, we can just skip them.
      if (
        dependency.target.startsWith('npm:') &&
        !projGraph.externalNodes[dependency.target]
      )
        return;

      acc.push({ name: dependency.target, isTopLevel: areTopLevelDeps });
      const isInternalTarget = projGraph.nodes[dependency.target];
      if (!shallow && isInternalTarget) {
        collectDependencies(dependency.target, projGraph, acc, shallow, false);
      }
    } else if (areTopLevelDeps && !existingEntry.isTopLevel) {
      existingEntry.isTopLevel = true;
    }
  });
  return acc;
}

/**
 *
 * @param taskGraph
 * @param projectGraph
 * @param root
 * @param projectName
 * @param targetName
 * @param configurationName
 * @param shallow
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/7f11a1d7d3f2e8a28fef50cdbbb6c4bfc25d6cf7/packages/js/src/utils/buildable-libs-utils.ts#L223C1-L314C2
 */
export function calculateDependenciesFromTaskGraph(
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph,
  root: string,
  projectName: string,
  targetName: string,
  configurationName: string,
  shallow?: boolean
): {
  target: ProjectGraphProjectNode;
  dependencies: DependentBuildableProjectNode[];
  nonBuildableDependencies: string[];
  topLevelDependencies: DependentBuildableProjectNode[];
} {
  const target = projectGraph.nodes[projectName];
  const nonBuildableDependencies = [];
  const topLevelDependencies: DependentBuildableProjectNode[] = [];

  const dependentTasks = collectDependentTasks(
    projectName,
    `${projectName}:${targetName}${
      configurationName ? `:${configurationName}` : ''
    }`,
    taskGraph,
    projectGraph,
    shallow
  );

  const npmDependencies = collectNpmDependencies(
    projectName,
    projectGraph,
    !shallow ? dependentTasks : undefined
  );

  const dependencies: DependentBuildableProjectNode[] = [];
  for (const [taskName, { isTopLevel }] of dependentTasks) {
    let project: DependentBuildableProjectNode = null;
    const depTask = taskGraph.tasks[taskName];
    const depProjectNode = projectGraph.nodes?.[depTask.target.project];
    if (depProjectNode?.type !== 'lib') {
      continue;
    }

    let outputs = getOutputsForTargetAndConfiguration(
      depTask.target,
      depTask.overrides,
      depProjectNode
    );

    if (outputs.length === 0) {
      nonBuildableDependencies.push(depTask.target.project);
      continue;
    }

    const libPackageJsonPath = join(
      root,
      depProjectNode.data.root,
      'package.json'
    );

    project = {
      name: fileExists(libPackageJsonPath)
        ? readJsonFile(libPackageJsonPath).name // i.e. @workspace/mylib
        : depTask.target.project,
      outputs,
      node: depProjectNode,
    };

    if (isTopLevel) {
      topLevelDependencies.push(project);
    }

    dependencies.push(project);
  }

  for (const { project, isTopLevel } of npmDependencies) {
    if (isTopLevel) {
      topLevelDependencies.push(project);
    }

    dependencies.push(project);
  }

  dependencies.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

  return {
    target,
    dependencies,
    nonBuildableDependencies,
    topLevelDependencies,
  };
}

/**
 *
 * @param projectName
 * @param projectGraph
 * @param dependentTasks
 * @param collectedPackages
 * @param isTopLevel
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/7f11a1d7d3f2e8a28fef50cdbbb6c4bfc25d6cf7/packages/js/src/utils/buildable-libs-utils.ts#L316C1-L366C2
 */
function collectNpmDependencies(
  projectName: string,
  projectGraph: ProjectGraph,
  dependentTasks:
    | Map<string, { project: string; isTopLevel: boolean }>
    | undefined,
  collectedPackages = new Set<string>(),
  isTopLevel = true
): Array<{ project: DependentBuildableProjectNode; isTopLevel: boolean }> {
  const dependencies: Array<{
    project: DependentBuildableProjectNode;
    isTopLevel: boolean;
  }> = projectGraph.dependencies[projectName]
    .map((dep) => {
      const projectNode =
        projectGraph.nodes?.[dep.target] ??
        projectGraph.externalNodes?.[dep.target];
      if (
        projectNode?.type !== 'npm' ||
        collectedPackages.has(projectNode.data.packageName)
      ) {
        return null;
      }

      const project = {
        name: projectNode.data.packageName,
        outputs: [],
        node: projectNode,
      };
      collectedPackages.add(project.name);

      return { project, isTopLevel };
    })
    .filter((x) => !!x);

  if (dependentTasks?.size) {
    for (const [, { project: projectName }] of dependentTasks) {
      dependencies.push(
        ...collectNpmDependencies(
          projectName,
          projectGraph,
          undefined,
          collectedPackages,
          false
        )
      );
    }
  }

  return dependencies;
}

/**
 *
 * @param project
 * @param task
 * @param taskGraph
 * @param projectGraph
 * @param shallow
 * @param areTopLevelDeps
 * @param dependentTasks
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/7f11a1d7d3f2e8a28fef50cdbbb6c4bfc25d6cf7/packages/js/src/utils/buildable-libs-utils.ts#L368-L410
 */
function collectDependentTasks(
  project: string,
  task: string,
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph,
  shallow?: boolean,
  areTopLevelDeps = true,
  dependentTasks = new Map<string, { project: string; isTopLevel: boolean }>()
): Map<string, { project: string; isTopLevel: boolean }> {
  for (const depTask of taskGraph.dependencies[task] ?? []) {
    if (dependentTasks.has(depTask)) {
      if (!dependentTasks.get(depTask).isTopLevel && areTopLevelDeps) {
        dependentTasks.get(depTask).isTopLevel = true;
      }
      continue;
    }

    const { project: depTaskProject } = parseTargetString(
      depTask,
      projectGraph
    );
    if (depTaskProject !== project) {
      dependentTasks.set(depTask, {
        project: depTaskProject,
        isTopLevel: areTopLevelDeps,
      });
    }

    if (!shallow) {
      collectDependentTasks(
        depTaskProject,
        depTask,
        taskGraph,
        projectGraph,
        shallow,
        depTaskProject === project && areTopLevelDeps,
        dependentTasks
      );
    }
  }

  return dependentTasks;
}
