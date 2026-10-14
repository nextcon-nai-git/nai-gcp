import { GET as handleGET, POST as handlePOST } from "@/app/api/pgr/agent-review/route";

export const runtime = "nodejs";
export const maxDuration = 90;
export const GET = handleGET;
export const POST = handlePOST;
