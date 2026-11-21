const errors = {
  400: ["INVALID_INPUT", "Check the supplied parameters and try again."],
  404: ["NOT_FOUND", "The requested catalog record could not be found."],
  503: ["SERVICE_UNAVAILABLE", "Catalog temporarily unavailable."],
} as const;

export function apiError(status: keyof typeof errors) {
  const [code, message] = errors[status];
  return Response.json({ data: null, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
