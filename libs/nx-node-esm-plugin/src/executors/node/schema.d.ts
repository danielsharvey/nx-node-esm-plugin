export interface NodeExecutorSchema {
  buildTarget: string;
  buildTargetOptions?: Record<string, any>;

  fileToRunMode?: 'packageJson' | 'specified' | 'fromBuildTarget';
  fileToRun?: string;

  args?: string[];
  moduleResolutionOverrides?: { [specifier:string]: string };

  color?: boolean;
  cwd?: string;
  env?: Record<string, string>;
  envFile?: string;
  // usePty?: boolean;
  streamOutput?: boolean;
  tty?: boolean;
  _: string[];
  __unparsed__: string[];
}
