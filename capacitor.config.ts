import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.piralimohamadhosein.pelc",
  appName: "پلک",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#1a1408",
  },
};

export default config;
