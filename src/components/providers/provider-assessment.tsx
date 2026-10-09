"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ProviderAssessmentValues {
  active: boolean;
  rating: number;
  ratingNote: string;
}

export function ProviderAssessment({
  initialValues,
  onSave,
}: {
  initialValues: ProviderAssessmentValues;
  onSave: (values: ProviderAssessmentValues) => Promise<void>;
}) {
  const [values, setValues] = React.useState(initialValues);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const validRating = Number.isInteger(values.rating) && values.rating >= 1 && values.rating <= 5;

  async function save() {
    if (!validRating || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await onSave({ ...values, ratingNote: values.ratingNote.trim() });
      setMessage("Situação, classificação e observação salvas.");
    } catch {
      setMessage("Não foi possível salvar a avaliação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Avaliação do prestador" className="space-y-4 border-t pt-6">
      <h3 className="font-bold text-primary">Situação e avaliação do prestador</h3>
      <fieldset disabled={saving} className="space-y-4">
        <label className="flex items-center gap-3 text-sm">
          Situação
          <select
            aria-label="Situação do prestador"
            className="rounded-md border bg-white p-2"
            value={values.active ? "active" : "inactive"}
            onChange={(event) => setValues({ ...values, active: event.target.value === "active" })}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </label>
        <div
          role="group"
          aria-label="Classificação de 1 a 5 estrelas"
          className="flex items-center gap-2"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}`}
              aria-pressed={values.rating === star}
              className="rounded p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => setValues({ ...values, rating: star })}
            >
              <Star
                aria-hidden="true"
                className={
                  star <= values.rating ? "fill-amber-400 text-amber-500" : "text-slate-300"
                }
              />
            </button>
          ))}
          <span className="text-sm">{validRating ? `${values.rating}/5` : "Sem avaliação"}</span>
        </div>
        <label className="block space-y-2 text-sm">
          <span>Observação da avaliação — rodapé da ficha</span>
          <Textarea
            value={values.ratingNote}
            maxLength={5000}
            rows={3}
            onChange={(event) => setValues({ ...values, ratingNote: event.target.value })}
          />
        </label>
        <Button type="button" onClick={save} disabled={!validRating || saving}>
          {saving ? "Salvando avaliação…" : "Salvar situação e avaliação"}
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
