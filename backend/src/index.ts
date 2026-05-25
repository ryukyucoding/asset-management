import { buildApp } from './app';

async function bootstrap(): Promise<void> {
  const fastify = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Server running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
