import { POST as handlePOST } from "@/app/api/pgr/save/route";

export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = handlePOST;
