"use server";

import { saveDemoCase } from "@/lib/domain/fixtures";
import type { SlaCase } from "@/lib/domain/types";
import { redirect } from "next/navigation";

export async function createCaseAction(slaCase: SlaCase) {
  // Save to the file-backed JSON database
  saveDemoCase(slaCase);
  // Redirect back to the case queue dashboard
  redirect("/");
}
