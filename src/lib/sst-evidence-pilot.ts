import type { AsoFlowCard } from "./aso-flow";

/** Evidence projection, never a status mutation or a medical determination. */
export function reconcileAsoEvidence(card: AsoFlowCard, today: string) {
  const received = !!card.aso?.hash && !!card.aso.reference;
  const reviewed =
    received &&
    card.review?.hash === card.aso?.hash &&
    card.review?.identityConfirmed === true &&
    card.review?.documentChecked === true;
  const delivered =
    reviewed && card.delivery?.hash === card.aso?.hash && !!card.delivery?.reference;
  const explicitAbsence =
    card.status === "no_show" &&
    card.events.some((event) => event.status === "no_show" && !!event.actor && !!event.at);
  const attended = !!card.attendedDate || (received && !!card.aso?.examDate);
  return {
    received,
    reviewed,
    delivered,
    attendance: attended
      ? "Realização documentada"
      : explicitAbsence
        ? "Falta registrada"
        : card.appointment?.date && card.appointment.date < today
          ? "Realização não confirmada"
          : "Sem comprovação de realização",
    discrepancy:
      (card.status === "received" && !received) ||
      (card.status === "reviewed" && !reviewed) ||
      (card.status === "delivered" && !delivered) ||
      (card.status === "no_show" && (attended || !explicitAbsence)),
  };
}

/** Shadow-mode only. The caller must establish a clinically eligible cohort first. */
export function contactPilotScore(probability: number, minutes: number, calibrated: boolean) {
  if (
    !calibrated ||
    !Number.isFinite(probability) ||
    probability < 0 ||
    probability > 1 ||
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    minutes > 1440
  )
    return null;
  return probability * minutes;
}

/** Prediction quality never implies explanation fidelity or clinical validity. */
export function specialistReviewGate(input: {
  dataQualityConfirmed: boolean;
  predictionValidated: boolean;
  explanationValidated: boolean;
  professionalApproved: boolean;
}) {
  const pending = Object.entries(input)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  return { pending, readyForProfessionalUse: pending.length === 0 };
}
