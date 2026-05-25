import { genlayerVerifierAdapter } from "@/lib/verifier/genlayer-adapter";
import { mockVerifierAdapter } from "@/lib/verifier/mock-adapter";
import type { SlaVerifier, VerifierMode, VerifierReadiness } from "@/lib/verifier/types";

export function getVerifierMode(): VerifierMode {
  return process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER === "genlayer" ? "genlayer" : "mock";
}

export function getVerifier(): SlaVerifier {
  return getVerifierMode() === "genlayer" ? genlayerVerifierAdapter : mockVerifierAdapter;
}

export function getVerifierReadiness(): VerifierReadiness {
  return getVerifier().readiness;
}

