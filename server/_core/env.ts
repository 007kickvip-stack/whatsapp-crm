export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  hualeiBaseUrl: process.env.HUALEI_BASE_URL ?? "http://111.230.184.181:8082",
  hualeiUsername: process.env.HUALEI_USERNAME ?? "",
  hualeiPassword: process.env.HUALEI_PASSWORD ?? "",
};
