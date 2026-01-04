import { config } from "dotenv";

config();

export const env = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgres://arena402:arena402@localhost:5432/arena402",

  // Are.na OAuth (Phase 2)
  arenaClientId: process.env.ARENA_CLIENT_ID || "",
  arenaClientSecret: process.env.ARENA_CLIENT_SECRET || "",
  arenaRedirectUri: process.env.ARENA_REDIRECT_URI || "http://localhost:3000/auth/arena/callback",

  // JWT (Phase 2)
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-in-production",

  // x402 (Phase 4)
  facilitatorUrl: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
  baseRpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
} as const;

export const isProduction = env.nodeEnv === "production";
export const isDevelopment = env.nodeEnv === "development";
