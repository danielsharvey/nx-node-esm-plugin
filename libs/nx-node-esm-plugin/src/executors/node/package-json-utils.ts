import { logger } from "@nx/devkit";
import { readFileSync, statSync } from "fs";
import { join } from "path";
import * as chalk from 'chalk';
import { resolveExports } from "resolve-pkg-maps";

/**
 * Check whether file exists.
 * @param pth
 * @returns `true` if the pth exists and is an ordinary file
 */
export function fileExists(pth: string) {
  return statSync(pth, { throwIfNoEntry: false })?.isFile() ?? false;
}

const legacyMainResolveExtensions = [
  '',
  '.js',
  '.json',
  '.node',
  '/index.js',
  '/index.json',
  '/index.node',
];

const legacyMainResolveFallbacks = [
  './index.js',
  './index.json',
  './index.node',
];

/**
 * Resolves the file to run for the specified `package.json` based
 * library/application.
 *
 * Attempts resolution via the `exports` entry (using `resolve-pkg-maps`)
 * and then via Node's legacy CommonJS resolution using the `main` field.
 *
 * @param outputPath the Nx project output path as a absolute path, usually in the `dist/` folder
 * @returns the absolute path of the file to run
 *
 * @see libs/node-runner/src/lib/node-loader.ts
 */
export function resolveFileToRunFromPackageJson(
  outputPath: string,
) {

  // read package.json
  const pkgJsonPath = join(outputPath, 'package.json');
  if (!fileExists(pkgJsonPath)) {
    logger.error(
      `Missing package.json: ${chalk.bold(pkgJsonPath)}`
    );
    return undefined;
  }

  let pkgJson: any;
  try {
    pkgJson = JSON.parse(readFileSync(pkgJsonPath, { encoding: 'utf-8' }));
  } catch (error) {
    logger.error(
      `Error loading: ${chalk.bold(pkgJsonPath)}: ${chalk.red(''+error)}`
    );
    return undefined;
  }

  // attempt resolution via exports
  if (pkgJson.exports) {
    const resolvedPaths = resolveExports(
      pkgJson.exports,
      '',
      ['node', 'import']
    );

    if (resolvedPaths?.[0]) {
      const resolvedPath = join(outputPath, resolvedPaths[0]);
      if (fileExists(resolvedPath)) {
        return resolvedPath;
      } else {
        logger.error(
          `Missing export: ${chalk.bold(pkgJsonPath)}: ${chalk.red(resolvedPath)}`
        );
        return undefined;
      }
    }
  }

  // Legacy CommonJS main resolution
  if (pkgJson.main) {
    for (const ext of legacyMainResolveExtensions) {
      const resolvedPath = join(outputPath, `${pkgJson.main}${ext}`);
      if (fileExists(resolvedPath)) {
        return resolvedPath;
      }
    }
    logger.error(
      `Unable to resolve package main entry: ${chalk.bold(pkgJsonPath)}: ${chalk.red(pkgJson.main)}`
    );
  } else {
    for (const index of legacyMainResolveFallbacks) {
      const resolvedPath = join(outputPath, index);
      if (fileExists(resolvedPath)) {
        return resolvedPath;
      }
    }
    logger.error(
      `Unable to resolve package fallback main entry: ${chalk.bold(pkgJsonPath)}`
    );
  }

  return undefined;
}
