"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { availability } from "@/features/catalog/presentation";
import { costRequest, tokenLimit } from "../schemas/compare";

const estimateResponse = z.object({
  data: z.array(z.object({
    offeringId: z.string(),
    provider: z.string(),
    amount: z.string().nullable(),
    currency: z.string().nullable(),
    observedAt: z.string().nullable(),
  })).max(4),
});

type Estimate = z.infer<typeof estimateResponse>["data"][number];
type ModelOption = {
  id: string;
  name: string;
  offerings: { id: string; provider: string; availabilityStatus: keyof typeof availability }[];
};

export function CostCalculator({ models }: { models: ModelOption[] }) {
  const [pending, setPending] = useState(false);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [error, setError] = useState("");

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const input = costRequest.safeParse({
      offeringIds: values.getAll("offeringId").filter(Boolean),
      inputTokens: Number(values.get("inputTokens")),
      outputTokens: Number(values.get("outputTokens")),
    });
    setEstimates([]);
    if (!input.success) {
      setError("Select at least one offering and enter whole token counts from zero to one trillion.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/compare/cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Cost unavailable");
      setEstimates(estimateResponse.parse(await response.json()).data);
    } catch {
      setError("Estimates are temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="calculator" className="panel mt-6">
      <h2 id="calculator">Token cost estimator</h2>
      <p className="muted mt-2">Use historical rates for the same workload. Estimates exclude caching, batch discounts, taxes, and tiering.</p>
      <form onSubmit={calculate} onChange={() => { setEstimates([]); setError(""); }} className="mt-4">
        <fieldset disabled={pending} className="grid gap-4">
          <legend className="sr-only">Workload and provider offerings</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>Input tokens<input name="inputTokens" type="number" min={0} max={tokenLimit} step={1} required defaultValue={1_000_000} /></label>
            <label>Output tokens<input name="outputTokens" type="number" min={0} max={tokenLimit} step={1} required defaultValue={100_000} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {models.map((model) => <label key={model.id}>{model.name} offering
              <select name="offeringId" defaultValue={model.offerings.find((offer) => offer.availabilityStatus === "LISTED")?.id ?? ""}>
                <option value="">{model.offerings.length ? "Skip this model" : "No offering documented"}</option>
                {model.offerings.map((offer) => <option key={offer.id} value={offer.id}>{offer.provider} · {availability[offer.availabilityStatus]}</option>)}
              </select>
            </label>)}
          </div>
          <button type="submit" className="button primary justify-self-start">{pending ? "Calculating…" : "Estimate cost"}</button>
        </fieldset>
      </form>
      {error && <p role="alert" className="mt-4 error-text">{error}</p>}
      <div aria-live="polite">
        {estimates.length > 0 && <ul className="detail-list mt-4">{estimates.map((estimate) => {
          const model = models.find(({ offerings }) => offerings.some(({ id }) => id === estimate.offeringId));
          return <li key={estimate.offeringId}>
            <strong>{model?.name} · {estimate.provider}</strong>
            <p>{estimate.amount === null ? "Unknown cost" : `${estimate.currency} ${estimate.amount}`}</p>
            {estimate.observedAt && <p className="muted text-sm">Historical price observed {estimate.observedAt.slice(0, 10)}</p>}
          </li>;
        })}</ul>}
      </div>
    </section>
  );
}
