import { guard, ok } from "@/lib/http";
import { startNextAttempt } from "@/lib/practice";
import { getDb } from "@/lib/server-db";

/** Ask the selector for the next question and open an attempt on it. */
export async function POST() {
  return guard(() => {
    const attempt = startNextAttempt(getDb());
    return ok({ attempt });
  });
}
