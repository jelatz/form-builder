import { buildServer } from './app.ts';
import { createNeonDb } from './db/client.ts';
import { NeonDrizzleStore } from './db/neon-store.ts';
import { loadServerEnv } from './env.ts';

async function start(): Promise<void> {
  const env = loadServerEnv();
  const db = createNeonDb(env.databaseUrl);
  const store = new NeonDrizzleStore(db);

  const app = await buildServer({
    store,
    isProduction: env.isProduction,
    logger: !env.isProduction,
  });

  await app.listen({ port: env.port, host: '0.0.0.0' });
  console.log(`FormBuilder Fastify API listening on http://localhost:${env.port}`);
}

start().catch((error: unknown) => {
  console.error('Failed to start Fastify API server:', error);
  process.exit(1);
});
