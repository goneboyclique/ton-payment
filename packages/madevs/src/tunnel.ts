import { startTunnel } from "untun";
import { forward } from "@ngrok/ngrok";

export async function createTunnel(port: number) {
  console.log('port', port)
  try {
    return await forward({ addr: `localhost:${port}` , authtoken: '1bFtDMU3BmMoO45PpQ64SypLmxT_4G5aFpbkmGFbHmMXBaVB2', authtoken_from_env: true })
  } catch (e) { console.error(e) }
}
