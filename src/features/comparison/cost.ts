type Price = {
  inputPerMillion: { toFixed: (digits: number) => string } | null;
  outputPerMillion: { toFixed: (digits: number) => string } | null;
};

export function estimateCost(price: Price | null, inputTokens: number, outputTokens: number) {
  if (!price || price.inputPerMillion === null || price.outputPerMillion === null) return null;

  // Prices have eight decimal places per million tokens, so the total has fourteen.
  const input = BigInt(price.inputPerMillion.toFixed(8).replace(".", ""));
  const output = BigInt(price.outputPerMillion.toFixed(8).replace(".", ""));
  const digits = (input * BigInt(inputTokens) + output * BigInt(outputTokens)).toString().padStart(15, "0");
  const fraction = digits.slice(-14).replace(/0+$/, "").padEnd(2, "0");
  return `${digits.slice(0, -14)}.${fraction}`;
}
