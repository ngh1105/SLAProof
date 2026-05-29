import { getCaseStore } from "@/lib/storage/case-store-factory";
import type { SlaCase } from "./types";

// Async façade over the configured case store. Server Components and Server
// Actions await these. Backend selection lives in the factory.
export async function getDemoCases(): Promise<SlaCase[]> {
  return getCaseStore().list();
}

export async function getDemoCase(caseId: string): Promise<SlaCase | undefined> {
  return getCaseStore().get(caseId);
}

export async function saveDemoCase(slaCase: SlaCase): Promise<void> {
  await getCaseStore().save(slaCase);
}
