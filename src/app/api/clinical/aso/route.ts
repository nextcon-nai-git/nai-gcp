import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import {
  completeClinicalAppointmentWithAso,
  reviewClinicalAso,
} from "@/services/clinical-aso-completion";

export const runtime = "nodejs";

const Input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    companyId: z.string().min(1).max(128),
    cardId: z.string().regex(/^[a-f0-9]{64}$/),
    employeeId: z.string().min(1).max(128),
    appointmentId: z.string().min(1).max(128),
    appointmentSnapshot: z.object({
      appointmentId: z.string().min(1).max(128),
      companyId: z.string().min(1).max(128),
      companyName: z.string().min(1).max(256),
      employeeId: z.string().min(1).max(128),
      employeeName: z.string().min(1).max(256),
      type: z.string().min(1).max(128),
      dateTime: z.string().min(1).max(128),
    }),
    confirmedOriginal: z.literal(true),
  }),
  z.object({
    action: z.literal("complete"),
    companyId: z.string().min(1).max(128),
    cardId: z.string().regex(/^[a-f0-9]{64}$/),
    employeeId: z.string().min(1).max(128),
    appointmentId: z.string().min(1).max(128),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    const input = Input.parse(await limitedJson(request, 4096));
    const result =
      input.action === "review"
        ? await reviewClinicalAso(user, input)
        : await completeClinicalAppointmentWithAso(user, input);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof AuthError) return privateFailure(error);
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Confira os dados do documento e atendimento." },
        { status: 400, headers: privateHeaders }
      );
    return NextResponse.json(
      {
        error:
          "Não foi possível confirmar o vínculo. O atendimento permanece aberto para retomada.",
      },
      { status: 503, headers: privateHeaders }
    );
  }
}
