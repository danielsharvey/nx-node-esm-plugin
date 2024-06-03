# Node Executor for Nx with ESM support

Node executor including ESM module resolution for buildable libraries within Nx workspaces.


## Why this plugin?

Nx allows you to easily add structure to your workspace.

For JavaScript/TypeScript projects this includes a clean structure, DX and
tooling for developing multiple applications and libraries:

- **Build.** When compiling code that references
  [buildable libraries](https://nx.dev/concepts/buildable-and-publishable-libraries)
  within the workspace, [`@nx/js:tsc`](https://nx.dev/nx-api/js/executors/tsc)
  automatically generates temporary `tsconfig`'s that link the code being compiled
  and the libraries referenced (imported/required).
- **Execute.** When running code during development (within the workspace prior
  to deployment/release/publication), the
  [`@nx/js:node`](https://nx.dev/nx-api/js/executors/node) executor includes
  support for `require`ing CommonJS code from libraries
  referenced from other buildable libraries within the workspace. 

> [!WARNING] 
> However, this currently works for CommonJS applications
> (`"type": "commonjs"` in `package.json`) but not for 
> ESM applications (`"type": "module"`).

Errors look something like this:
```bash
Error: Cannot find package '@my-scope/my-lib' imported from /Users/daniel/projects/test/dist/apps/test-app/src/lib/test-app.js
```

Nx will probably address this in the future - it's discussed at least
[here](https://github.com/nrwl/nx/issues/11335#issuecomment-2136663019),
and [here](https://github.com/nrwl/nx/issues/21928) -
but for today this [plugin](https://nx.dev/concepts/nx-plugins) seeks to
provide a close to drop-in replacememt.


## Getting started

The `nx-node-esm-plugin` plugin includes a sample application and a preset
to enable you to try it easily:

![nx-node-esm-plugin demo](https://github.com/danielsharvey/nx-node-esm-plugin/assets/12858056/e3e7a351-8f1a-4a74-b779-c1673a34994f)

View demo <a href="https://asciinema.org/a/JbInpZIXDGlaeD2XMCmKxI7uq" target="_blank">screencast</a>.


### Using the preset

```
# Create Nx workspace with preset sample app
npx create-nx-workspace test --preset=@harves/nx-node-esm-plugin

# Take a look at the sampleapp
cd test

# Run the standard Node executor (fails)
npx nx run test-app:run-js-node

# Run using the nx-node-esm-plugin executor
npx nx run test-app:run-node-esm-plugin
```

### Adding a sample app to an existing workspace

```
# Add plugin
npx nx add @harves/nx-node-esm-plugin

# Use code generator to add the sample library + application
npx nx g @harves/nx-node-esm-plugin:sample-app test

# View sample app project details
npx nx show project test-app --web

# Run the standard Node executor (fails)
npx nx run test-app:run-js-node

# Run using the nx-node-esm-plugin executor
npx nx run test-app:run-node-esm-plugin
```

### The `nx-node-esm-plugin:node` executor

A quickstart guide to using the node executor in this plugin:

From this `project.json`:
```json
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "dependsOn": ["build"],
      "options": {
        "buildTarget": "build",
        "watch": false
      }
    }
  }
```

To this:
```json
  "targets": {
    "serve": {
      "executor": "@harves/nx-node-esm-plugin:node",
      "dependsOn": ["build"],
      "options": {
        "buildTarget": "build"
      }
    }
  }
```
(*) The `nx-node-esm-plugin:node` executor in this plugin does not support file watch mode.


## Node Loader Details

The resolver and loader function provided with this plugin includes
support for module resolution for ESM and require support for CommonJS
(equivalent to the existing Nx Node executor).

### Module Resolution for ESM

This plugin resolves Node ESM import specifiers for buildable
Nx libraries by mapping the library specifiers to the library's
built output paths.

It also includes support for configurable overrides.

All other specifiers are deferred to the parent resolver.

The resolution algorithm works as follows (based on the Node specification):

1. Assumes that the mapped Nx library output paths contain a valid
   `package.json`.

2. Attempts to resolve the library imports for mapped libraries
   using the Node's ESM Module resolution algorithm, with the
   assumption that all Nx library specifiers are "bare specifiers".

3. Attempts to resolve using the `package.json` `exports`
   property using the `resolve-pkg-maps` package.

4. Falls back to attempting resolution using the `package.json` `main`
   property using Node's legacy CommonJS resolution algorithm.

The legacy CommonJS main resolution is as follows:
1. let M = pkg_url + (json main field)
2. TRY(M, M.js, M.json, M.node)
3. TRY(M/index.js, M/index.json, M/index.node)
4. TRY(pkg_url/index.js, pkg_url/index.json, pkg_url/index.node)
5. NOT_FOUND

References:
- Node's [ESM Module Resolution algorithm](https://nodejs.org/api/esm.html)
- Node's legacy CommonJS main resolution code 
  ([here](https://github.com/nodejs/node/blob/d57af10d1be390f4e33e6efe596133de9da36c86/lib/internal/modules/esm/resolve.js#L189-L200)
  and [here](https://github.com/nodejs/node/blob/v16.14.0/lib/internal/modules/esm/resolve.js#L299))
- The [resolve-pkg-maps package](https://www.npmjs.com/package/resolve-pkg-maps)


### Require Loader for CommonJS

This plugin resolves Node CommonJS require's for buildable
Nx libraries by mapping the library require request to the library's
built output paths.

It also includes support for configurable overrides.

All other request values are deferred to the parent loader.


## Executor Documentation

The `@harves/nx-node-esm-plugin:node` executor in this plugin functions
very similarly to the [`@nx/js:node`](https://nx.dev/nx-api/js/executors/node)
that is provided by Nx.

The basic operation of the executor:

1. Utilise the provided `buildTarget` and create a task graph (**)
   from which the build dependencies may be computed.

2. For these dependencies, assemble mappings from the library
   specifiers (e.g. `@my-scope/my-lib`) to the build output
   directory (e.g. `dist/libs/my-lib`).

3. Invoke the selected Node file with module resolution and
   require loaders customised to utilise these mappings.

(**) The task graph algorithm is based on a more recent Nx changes
enabled by the `NX_BUILDABLE_LIBRARIES_TASK_GRAPH` environment variable
(not required to be set for this plugin) - see 
[here](https://github.com/nrwl/nx/issues/22043#issuecomment-1970865976),
[here](https://github.com/nrwl/nx/issues/21395#issuecomment-1916808025), and
[here](https://github.com/nrwl/nx/issues/18257#issuecomment-1824139189).

The full executor schema may be found in 
[libs/nx-node-esm-plugin/src/executors/node/schema.json](libs/nx-node-esm-plugin/src/executors/node/schema.json).

### Executor Options

The available `options` are as follows:

#### `buildTarget`
*<p style="color:green">string</p>*
The target to run to build you the app.

#### `buildTargetOptions`
*<p style="color:green">object</p>*
Additional options to pass into the build target.

#### `fileToRunMode`
*<p style="color:green">string; enum ("packageJson", "fromBuildTarget", "specified")</p>*
Mode specifying how the Node file to run is determined; either from the package.json of the build target, inferred from the build target or specified explicitly.

#### `fileToRun`
*<p style="color:green">string</p>*
Optional specification of the Node file to run (if present this setting overrides `fileToRunMode`).

#### `args`
*<p style="color:green">array [string]</p>*
Arguments passed to the Node script.

#### `moduleResolutionOverrides`
*<p style="color:green">object</p>*
Optional ESM module resolution overrides; key is the specifier, value if the full absolute path of the file to load. e.g.
```json
{
  "moduleResolutionOverrides": {
    "@my-scope/my-lib": "/Users/daniel/project-name/libs/some-dir"
  }
}
```

#### `color`
*<p style="color:green">boolean (default false)</p>*
Use colors when showing output of command.

#### `cwd`
*<p style="color:green">string</p>*
Current working directory of the commands. If it's not specified the commands will run in the workspace root, if a relative path is specified the commands will run in that path relative to the workspace root and if it's an absolute path the commands will run in that path.

#### `env`
*<p style="color:green">object</p>*
Environment variables that will be made available to the commands. This property has priority over the `.env` files.
```json
{
  "env": {
    "SOME_ENV_VAR": "true"
  }
}
```

#### `envFile`
*<p style="color:green">string</p>*
You may specify a custom .env file path.

#### `__unparsed__`
*<p style="color:green">array [string]</p>*
Additional arguments added to `args` and passed to the Node script. Allows command line args to be passed to the script by the executor.


## Changelog

[Learn about the latest changes](CHANGELOG.md).


## Contributing

[Read about contributing to this project](CONTRIBUTING.md).
Please report issues on [GitHub](https://github.com/danielsharvey/nx-node-esm-plugin/issues).


## Credits 

✨ **This workspace has been generated by [Nx, Smart Monorepos · Fast CI.](https://nx.dev)** ✨

Rather than recreating from scratch, much of the code in this plugin
is taken from Nx. Links to the relevant Code in the Nx GitHub repo are
included. 
