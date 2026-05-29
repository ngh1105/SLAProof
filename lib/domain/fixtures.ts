import { fileCaseStore } from "@/lib/storage/case-store";
import type { SlaCase } from "./types";

// Async façade over the configured case store. Server Components and Server
// Actions await these. Storage backend selection lives in the store layer.
export async function getDemoCases(): Promise<SlaCase[]> {
  return fileCaseStore.list();
}

export async function getDemoCase(caseId: string): Promise<SlaCase | undefined> {
  return fileCaseStore.get(caseId);
}

export async function saveDemoCase(slaCase: SlaCase): Promise<void> {
  await fileCaseStore.save(slaCase);
}
