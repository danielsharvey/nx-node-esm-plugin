import { NodeExecutorSchema } from './schema';

export default async function runExecutor(options: NodeExecutorSchema) {
  console.log('Executor ran for Node', options);
  return {
    success: true,
  };
}
