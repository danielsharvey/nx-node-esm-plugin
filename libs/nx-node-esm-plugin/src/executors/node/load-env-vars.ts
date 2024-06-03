
/**
 *
 * @param path
 *
 * @see https://github.com/nrwl/nx/blob/d010267d83119638d325c5f92b76b4dac2dceb53/packages/nx/src/executors/run-commands/run-commands.impl.ts#L18C1-L29C2
 */
export async function loadEnvVars(path?: string) {
  if (path) {
    const result = (await import('dotenv')).config({ path });
    if (result.error) {
      throw result.error;
    }
  } else {
    try {
      (await import('dotenv')).config();
    // eslint-disable-next-line no-empty
    } catch {}
  }
}
