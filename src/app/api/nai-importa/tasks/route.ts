import { GET as handleGET, PATCH as handlePATCH } from "@/app/api/pgr/tasks/route";

export const runtime = "nodejs";
export const GET = handleGET;
export const PATCH = handlePATCH;
