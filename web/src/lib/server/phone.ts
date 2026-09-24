/**
 * Normalizes Kenyan phone numbers to 2547XXXXXXXX / 2541XXXXXXXX — the
 * format Daraja requires and what we use as the canonical stored form.
 * Accepts 07..., 01..., +2547..., 2547...
 */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\s|-/g, "").replace(/^\+/, "");
  let normalized: string | null = null;

  if (/^0(7|1)\d{8}$/.test(digits)) {
    normalized = "254" + digits.slice(1);
  } else if (/^254(7|1)\d{8}$/.test(digits)) {
    normalized = digits;
  } else if (/^(7|1)\d{8}$/.test(digits)) {
    normalized = "254" + digits;
  }

  if (!normalized) {
    throw new Error("Invalid phone number. Use 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXXX.");
  }
  return normalized;
}

export function isValidKenyanPhone(raw: string): boolean {
  try {
    normalizeKenyanPhone(raw);
    return true;
  } catch {
    return false;
  }
}
