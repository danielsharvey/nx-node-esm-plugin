import { ExecutorContext } from '@nx/devkit';
import * as chalk from 'chalk';
import { ChildProcess, fork } from 'child_process';
import { env as appendLocalEnv } from 'npm-run-path';
import * as path from 'path';


/**
 * @see https://github.com/nrwl/nx/blob/316dcb948cf172e4faef8866bc66a9002ed4c4e3/packages/nx/src/executors/run-commands/run-commands.impl.ts#L14
 */
export const LARGE_BUFFER = 1024 * 1000000;

/**
 * @see https://github.com/nrwl/nx/blob/316dcb948cf172e4faef8866bc66a9002ed4c4e3/packages/nx/src/executors/run-commands/run-commands.impl.ts#L16C1-L17C1
 */
const childProcesses = new Set<ChildProcess>();


/**
 *
 * @param out
 * @param config
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/316dcb948cf172e4faef8866bc66a9002ed4c4e3/packages/nx/src/executors/run-commands/run-commands.impl.ts#L417-L440
 */
function addColorAndPrefix(
  out: string,
  config: {
    prefix?: string;
    color?: string;
    bgColor?: string;
  }
) {
  if (config.prefix) {
    out = out
      .split('\n')
      .map((l) =>
        l.trim().length > 0 ? `${chalk.bold(config.prefix)} ${l}` : l
      )
      .join('\n');
  }
  if (config.color && chalk[config.color]) {
    out = chalk[config.color](out);
  }
  if (config.bgColor && chalk[config.bgColor]) {
    out = chalk[config.bgColor](out);
  }
  return out;
}

/**
 *
 * @param cwd
 * @param context
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/316dcb948cf172e4faef8866bc66a9002ed4c4e3/packages/nx/src/executors/run-commands/run-commands.impl.ts#L442-L449
 */
function calculateCwd(
  cwd: string | undefined,
  context: ExecutorContext
): string {
  if (!cwd) return context.root;
  if (path.isAbsolute(cwd)) return cwd;
  return path.join(context.root, cwd);
}

/**
 *
 * @param color
 * @param cwd
 * @param env
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/316dcb948cf172e4faef8866bc66a9002ed4c4e3/packages/nx/src/executors/run-commands/run-commands.impl.ts#L451-L466
 */
function processEnv(color: boolean, cwd: string, env: Record<string, string>) {
  const localEnv = appendLocalEnv({ cwd: cwd ?? process.cwd() });
  const res = {
    ...process.env,
    ...localEnv,
    ...env,
  };
  // need to override PATH to make sure we are using the local node_modules
  if (localEnv.PATH) res.PATH = localEnv.PATH; // UNIX-like
  if (localEnv.Path) res.Path = localEnv.Path; // Windows


  if (color) {
    res.FORCE_COLOR = `${color}`;
  }
  return res;
}


/**
 *
 * @param commandConfig
 * @param readyWhen
 * @param color
 * @param cwd
 * @param env
 * @param isParallel
 * @param usePty
 * @param streamOutput
 * @param tty
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/316dcb948cf172e4faef8866bc66a9002ed4c4e3/packages/nx/src/executors/run-commands/run-commands.impl.ts#L293C1-L353C2
 */
async function createProcess(
  pseudoTerminal: PseudoTerminal | null,
  commandConfig: {
    command: string;
    color?: string;
    bgColor?: string;
    prefix?: string;
  },
  readyWhen: string,
  color: boolean,
  cwd: string,
  env: Record<string, string>,
  isParallel: boolean,
  usePty: boolean = true,
  streamOutput: boolean = true,
  tty: boolean
): Promise<{ success: boolean; terminalOutput: string }> {
  env = processEnv(color, cwd, env);
  // The rust runCommand is always a tty, so it will not look nice in parallel and if we need prefixes
  // currently does not work properly in windows
  if (
    pseudoTerminal &&
    process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
    !commandConfig.prefix &&
    !isParallel &&
    usePty
  ) {
    let terminalOutput = chalk.dim('> ') + commandConfig.command + '\r\n\r\n';
    if (streamOutput) {
      process.stdout.write(terminalOutput);
    }


    const cp = pseudoTerminal.runCommand(commandConfig.command, {
      cwd,
      jsEnv: env,
      quiet: !streamOutput,
      tty,
    });


    childProcesses.add(cp);


    return new Promise((res) => {
      cp.onOutput((output) => {
        terminalOutput += output;
        if (readyWhen && output.indexOf(readyWhen) > -1) {
          res({ success: true, terminalOutput });
        }
      });


      cp.onExit((code) => {
        if (code >= 128) {
          process.exit(code);
        } else {
          res({ success: code === 0, terminalOutput });
        }
      });
    });
  }


  return nodeProcess(commandConfig, cwd, env, readyWhen, streamOutput);
}

/**
 *
 * @param commandConfig
 * @param cwd
 * @param env
 * @param readyWhen
 * @param streamOutput
 * @returns
 *
 * @see https://github.com/nrwl/nx/blob/316dcb948cf172e4faef8866bc66a9002ed4c4e3/packages/nx/src/executors/run-commands/run-commands.impl.ts#L355-L415
 */
function nodeProcess(
  commandConfig: {
    command: string;
    color?: string;
    bgColor?: string;
    prefix?: string;
  },
  cwd: string,
  env: Record<string, string>,
  readyWhen: string,
  streamOutput = true
): Promise<{ success: boolean; terminalOutput: string }> {
  let terminalOutput = chalk.dim('> ') + commandConfig.command + '\r\n\r\n';
  if (streamOutput) {
    process.stdout.write(terminalOutput);
  }
  return new Promise((res) => {
    const childProcess = exec(commandConfig.command, {
      maxBuffer: LARGE_BUFFER,
      env,
      cwd,
    });


    childProcesses.add(childProcess);


    childProcess.stdout.on('data', (data) => {
      const output = addColorAndPrefix(data, commandConfig);
      terminalOutput += output;
      if (streamOutput) {
        process.stdout.write(output);
      }
      if (readyWhen && data.toString().indexOf(readyWhen) > -1) {
        res({ success: true, terminalOutput });
      }
    });
    childProcess.stderr.on('data', (err) => {
      const output = addColorAndPrefix(err, commandConfig);
      terminalOutput += output;
      if (streamOutput) {
        process.stderr.write(output);
      }
      if (readyWhen && err.toString().indexOf(readyWhen) > -1) {
        res({ success: true, terminalOutput });
      }
    });
    childProcess.on('error', (err) => {
      const ouptput = addColorAndPrefix(err.toString(), commandConfig);
      terminalOutput += ouptput;
      if (streamOutput) {
        process.stderr.write(ouptput);
      }
      res({ success: false, terminalOutput });
    });
    childProcess.on('exit', (code) => {
      childProcesses.delete(childProcess);
      if (!readyWhen) {
        res({ success: code === 0, terminalOutput });
      }
    });
  });
}
