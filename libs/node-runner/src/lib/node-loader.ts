import { readFileSync, statSync } from 'fs';
import { isBuiltin } from 'module';
import { join } from 'path';
import { resolveExports } from 'resolve-pkg-maps';

const VERBOSE = process.env['NX_VERBOSE_LOGGING'] ?? false;

/**
 * These mappings map from the Nx library names (as per `package.json`
 * and as mapped in `{workspaceRoot}/tsconfig.base.json`) to the
 * built output folder for the library.
 *
 * @example
 * ```
 * {
 *   '@scope/pkg': '<absolute-path>/dist/libs/my-lib'
 * }
 * ```
 */
const mappings = JSON.parse(process.env['NX_MAPPINGS'] ?? '{}');

if(VERBOSE) {
  console.log(`node-loader: library mappings:`, mappings);
}

/**
 * The mappings are provided in configuration and are evaluated preferentially to
 * `mappings`.
 *
 * They map from module specifier to a target file.
 * @example
 * ```
 * {
 *   '@scope/pkg': '<absolute-path>/dist/libs/my-lib/some-other-file-to-load.js'
 * }
 * ```
 */
const moduleResolutionOverrides = JSON.parse(process.env['NX_MODULE_RESOLUTION_OVERRIDES'] ?? '{}');

if(VERBOSE) {
  console.log(`node-loader: moduleResolutionOverrides:`, moduleResolutionOverrides);
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

function fileExists(pth: string) {
  return statSync(pth, { throwIfNoEntry: false })?.isFile() ?? false;
}

class ModuleNotFoundError extends Error {
  public readonly code = 'MODULE_NOT_FOUND';
  constructor(specifier: string, resolvedPath: string, extraMsg?: string) {
    super(
      `node-runner: Failed to resolve mapped specifier '${specifier}': resolved path '${resolvedPath}' not found${
        extraMsg ? ' (' + extraMsg + ')' : ''
      }`
    );
  }
}

/**
 * This method resolves Node ESM import specifiers for buildable
 * Nx libraries by mapping the library specifiers to the library's
 * built output paths.
 *
 * It also includes support for configurable overrides.
 *
 * All other specifiers are deferred to the parent resolver.
 *
 * The resolution algorithm:
 *
 * 1. Assumes that the mapped Nx library output paths contain a valid
 *    `package.json`
 * 2. Attempts to resolve the library imports for mapped libraries
 *    using the Node's ESM Module resolution algorithm, with the
 *    assumption that all Nx library specifiers are "bare specifiers".
 * 3. Attempts to resolve using the `package.json` `exports`
 *    property using the `resolve-pkg-maps` package.
 * 4. Falls back to attempting resolution using the `package.json` `main`
 *    property using Node's legacy CommonJS resolution algorithm.
 *
 * Legacy CommonJS main resolution is as follows:
 * 1. let M = pkg_url + (json main field)
 * 2. TRY(M, M.js, M.json, M.node)
 * 3. TRY(M/index.js, M/index.json, M/index.node)
 * 4. TRY(pkg_url/index.js, pkg_url/index.json, pkg_url/index.node)
 * 5. NOT_FOUND
 *
 * See Node's ESM Module Resolution algorithm:
 * https://nodejs.org/api/esm.html
 *
 * See Node's legacy CommonJS main resolution code:
 * https://github.com/nodejs/node/blob/d57af10d1be390f4e33e6efe596133de9da36c86/lib/internal/modules/esm/resolve.js#L189-L200
 * and https://github.com/nodejs/node/blob/v16.14.0/lib/internal/modules/esm/resolve.js#L299.
 *
 * See the resolve-pkg-maps package:
 * https://www.npmjs.com/package/resolve-pkg-maps
 *
 * @see https://github.com/nrwl/nx/issues/11335#issuecomment-2136663019
 * @see https://github.com/nrwl/nx/issues/21928
 *
 * @param specifier
 * @param context
 * @param nextResolve
 * @returns
 */
export async function resolve(specifier: string, context: any, nextResolve: any) {

  if(VERBOSE) {
    console.log(`node-loader: resolving ${specifier}`);
  }

  if(typeof moduleResolutionOverrides === 'object') {
    if(specifier in moduleResolutionOverrides) {
      const resolvedPath = moduleResolutionOverrides[specifier];
      if(fileExists(resolvedPath)) {
        if(VERBOSE) {
          console.log(`node-loader: found override ${specifier} --> ${resolvedPath}`);
        }
        return nextResolve(resolvedPath, context);
      } else {
        throw new ModuleNotFoundError(specifier, resolvedPath, `Bad module resolution override`);
      }
    }
  }

  // not essential, but explicitly skip built-ins
  if (isBuiltin(specifier)) {
    return nextResolve(specifier, context);
  }

  if(typeof mappings === 'object') {

    for(const [libSpecifier, libPath] of Object.entries(mappings)) {
      const subpath =
        specifier === libSpecifier
          ? ''
          : specifier.startsWith(libSpecifier + '/')
          ? specifier.substring(libSpecifier.length + 1)
          : undefined;
      if(subpath !== undefined) {
        if(typeof libPath === 'string') {

          // console.log('GOT THECONTEXT', specifier, libPath, `-${subpath}-`, context);

          /*
           * read package.json
           */

          const pkgJsonPath = join(libPath, 'package.json');
          if(!fileExists(pkgJsonPath)) {
            throw new ModuleNotFoundError(specifier, pkgJsonPath, `Missing package.json`);
          }

          let pkgJson: any;
          try {
            pkgJson = JSON.parse(
              readFileSync(pkgJsonPath, { encoding: 'utf-8' })
            );
          } catch(error) {
            throw new ModuleNotFoundError(specifier, pkgJsonPath, ''+error);
          }

          /*
           * attempt resolution via exports
           */

          if(pkgJson.exports) {
            const resolvedPaths = resolveExports(
              pkgJson.exports,
              subpath,
              context.conditions
            );
            // console.log('RESOLVED PATHS', resolvedPaths);

            if(resolvedPaths?.[0]) {
              const resolvedPath = join(libPath, resolvedPaths[0]);
              if(fileExists(resolvedPath)) {
                if(VERBOSE) {
                  console.log(`node-loader: found mapping ${specifier} --> ${resolvedPath} (export match)`);
                }
                return nextResolve(resolvedPath, context);
              } else {
                throw new ModuleNotFoundError(specifier, resolvedPath);
              }
            }
          }

          /*
           * Legacy CommonJS main resolution
           */

          if(subpath === '') {
            if(pkgJson.main) {
              for(const ext of legacyMainResolveExtensions) {
                const resolvedPath = join(libPath, `${pkgJson.main}${ext}`);
                if(fileExists(resolvedPath)) {
                  // DEP0151
                  if(VERBOSE) {
                    console.log(`node-loader: found mapping ${specifier} --> ${resolvedPath} (legacy DEP0151)`);
                  }
                  return nextResolve(resolvedPath, context);
                }
              }
            } else {
              for(const index of legacyMainResolveFallbacks) {
                const resolvedPath = join(libPath, index);
                if(fileExists(resolvedPath)) {
                  // DEP0151
                  if(VERBOSE) {
                    console.log(`node-loader: found mapping ${specifier} --> ${resolvedPath} (legacy DEP0151)`);
                  }
                  return nextResolve(resolvedPath, context);
                }
              }
            }
          } else {
            throw new ModuleNotFoundError(specifier, pkgJsonPath, `Cannot resolve subpath '${subpath}'`);
          }

        } else {
          // libPath not string (INTERNAL ERROR?)
          throw new ModuleNotFoundError(specifier, JSON.stringify(libPath), `Bad mapping`);
        }
      }
    }

  }

  // fall through to default resolver
  return nextResolve(specifier, context);
}
