import { createServer, type Server } from 'node:net';

export type ReservedPort = Readonly<{
  port: number;
  release: () => Promise<void>;
}>;

const MIN_HIGH_PORT = 49_152;
const MAX_PORT = 65_535;

function randomHighPort(): number {
  return MIN_HIGH_PORT + Math.floor(Math.random() * (MAX_PORT - MIN_HIGH_PORT + 1));
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

export async function reserveLoopbackPort(maximumAttempts = 20): Promise<ReservedPort> {
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const port = randomHighPort();
    const server = createServer();
    try {
      await new Promise<void>((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
          server.off('error', rejectListen);
          resolveListen();
        });
      });
      let released = false;
      return {
        port,
        release: async () => {
          if (!released) {
            released = true;
            await closeServer(server);
          }
        },
      };
    } catch {
      if (server.listening) {
        await closeServer(server);
      }
    }
  }
  throw new Error(`Could not reserve a loopback port after ${maximumAttempts} attempts.`);
}
