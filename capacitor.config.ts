import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.glowtrail.app",
  appName: "GLOWTRAIL",
  webDir: "dist",
  backgroundColor: "#07080D",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
