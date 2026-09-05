import {
  createServerGoogleConnectionRepository,
  createServerGoogleConnectionService,
  getServerGoogleBrokerSecret,
} from "@/lib/google-connections";
import { createGoogleTokenBrokerHandler } from "@/lib/google-connections/broker";

export const POST = createGoogleTokenBrokerHandler({
  getSecret: getServerGoogleBrokerSecret,
  nowSeconds: () => Math.floor(Date.now() / 1_000),
  createRepository: createServerGoogleConnectionRepository,
  createService: createServerGoogleConnectionService,
});
