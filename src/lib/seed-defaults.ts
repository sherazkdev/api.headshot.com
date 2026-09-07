import { RemoteConfigService } from "../features/remote-config/index.js";

export async function seedDefaults() {
  await new RemoteConfigService().ensure();
}
