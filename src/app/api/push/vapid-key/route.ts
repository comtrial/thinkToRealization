import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  return successResponse({
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  });
}
