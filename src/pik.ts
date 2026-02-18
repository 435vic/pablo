
const keyPath = Deno.env.get('PIK_CLIENT_TLS_KEY');
const certPath = Deno.env.get('PIK_CLIENT_TLS_CERT');
const caPath = Deno.env.get('PIK_CLIENT_TLS_CA_CERT');
const socketPath = Deno.env.get('PIK_CLIENT_UDS_PATH');
const apiHost = Deno.env.get('PIK_CLIENT_HOST') ?? 'api.mc.boredvico.dev';

async function getPikClient(): Promise<Deno.HttpClient> {
  if (socketPath) {
    console.log(`[pik] using unix domain socket at ${socketPath} for communication`);
    return Deno.createHttpClient({
      proxy: { transport: "unix", path: socketPath }
    });
  }

  if (keyPath && certPath && caPath) {
    try {
      const key = await Deno.readTextFile(keyPath);
      const cert = await Deno.readTextFile(certPath);
      const caCert = await Deno.readTextFile(caPath);

      return Deno.createHttpClient({
        key,
        cert,
        caCerts: [ caCert ]
      });
    } catch (e) {
      console.error('Error while reading TLS PEM files: ', e);
      Deno.exit(1);
    }
  }

  throw new Error("Either PIK_CLIENT_UDS_PATH or PIK_CLIENT_TLS_{KEY,CERT,CA_CERT} must be set.");
}

export const pikClient = await getPikClient();
export const PIK_API_URL = `${socketPath ? "http://localhost" : `https://${apiHost}`}/api/v1`;
export const routes = {
  otp: {
    async verify(otp: string): Promise<{ uuid: string, otp: string, name: string } | undefined> {
      const response = await fetch(`${PIK_API_URL}/otp/${otp}`, { client: pikClient });
      if (response && response.ok) {
        return await response.json();
      }
    },
  },
  whitelist: {
    async add(uuid: string) {
      const response = await fetch(`${PIK_API_URL}/whitelist/${uuid}`, {
        client: pikClient,
        method: 'POST'
      });
      return response;
    }
  },
  async chat(msg: { author: string, content: string }) {
    const response = await fetch(`${PIK_API_URL}/chat`, {
      client: pikClient,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
      method: 'POST'
    }); 

    return response;
  },
};

export function makeStatsTask(callback: (data: { online: boolean, playerCount: number, players: string[] }) => void) {
  let stats = {
    online: false,
    playerCount: 0,
    players: []
  }

  const task = async () => {
    try {
      const result = await fetch(`${PIK_API_URL}/stats`, {
        client: pikClient
      });
      if (!result.ok) {
        console.warn(`[pik] Healthcheck failed for MC server!`, result.status, result.statusText);
        stats.online = false;
      } else {
        stats = await result.json();
      }
    } catch (e) {
      console.error(`[pik] Transport failed for server!`, e);
      stats.online = false;
    }

    callback(stats);
  }
  task();
  return task;
}

