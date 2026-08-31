"use client";

import { useActionState } from "react";
import type { EstimateState } from "@/app/actions/deliveries";
import { saveEstimateAction } from "@/app/actions/deliveries";

export function EstimateForm({
  deliveryId,
  defaultMass,
  defaultVolume,
}: {
  deliveryId: string;
  defaultMass: string;
  defaultVolume: string;
}) {
  const [state, action, pending] = useActionState(saveEstimateAction, {} as EstimateState);
  return (
    <form action={action} className="row" style={{ alignItems: "end" }}>
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <label>
        Est. mass (kg)
        <input name="estMassKg" defaultValue={defaultMass} />
      </label>
      <label>
        Est. volume (m³)
        <input name="estVolumeM3" defaultValue={defaultVolume} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save estimate"}
      </button>
      {state.error ? (
        <p style={{ color: "var(--danger)", margin: 0, flex: "1 1 100%" }} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
