const VERBOSE = process.env['NX_VERBOSE_LOGGING'] ?? false;

/*
 * register ESM loader
 */

import { register } from 'module';

register('./node-loader.js', import.meta.url);

/*
 * monkey patch CommonJS require loader
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const Module = require('node:module');

const originalLoader = Module._load;

// see docs in ./node-loader.ts
const mappings = JSON.parse(process.env['NX_MAPPINGS'] ?? '{}');
const moduleResolutionOverrides = JSON.parse(
  process.env['NX_MODULE_RESOLUTION_OVERRIDES'] ?? '{}'
);

/**
 * This method resolves Node CommonJS require's for buildable
 * Nx libraries by mapping the library require request to the library's
 * built output paths.
 *
 * It also includes support for configurable overrides.
 *
 * All other request values are deferred to the parent loader.
 *
 * @param request
 * @param parent
 * @param args
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/6f223005b880c47ee32870b2508c1e56d8e26152/packages/js/src/executors/node/node-with-require-overrides.ts#L11-L21
 */
Module._load = (request: string, parent: any, ...args: any[]) => {
  if (!parent) {
    return originalLoader.apply(this, [request, parent, ...args]);
  }

  if(VERBOSE) {
    console.log(`node-loader: requiring ${request}`);
  }

  if (typeof moduleResolutionOverrides === 'object') {
    if (request in moduleResolutionOverrides) {
      const resolvedRequest = moduleResolutionOverrides[request];
      if(VERBOSE) {
        console.log(`node-loader: found override ${request} --> ${resolvedRequest}`);
      }
      return originalLoader.apply(this, [resolvedRequest, parent, ...args]);
    }
  }

  if (typeof mappings === 'object') {
    if (request in mappings) {
      const resolvedRequest = mappings[request];
      if(VERBOSE) {
        console.log(`node-loader: found mapping ${request} --> ${resolvedRequest}`);
      }
      return originalLoader.apply(this, [resolvedRequest, parent, ...args]);
    }
  }

  // fall through to default loader
  return originalLoader.apply(this, [request, parent, ...args]);
};

/*
 * run the target file
 */

const dynamicImport = new Function('specifier', 'return import(specifier)');

dynamicImport(process.env['NX_FILE_TO_RUN']);
