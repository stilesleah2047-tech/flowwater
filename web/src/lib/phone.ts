export function isValidKenyanPhone(raw: string): boolean {
  const digits = raw.replace(/\s|-/g, "").replace(/^\+/, "");
  return /^0(7|1)\d{8}$/.test(digits) || /^254(7|1)\d{8}$/.test(digits) || /^(7|1)\d{8}$/.test(digits);
}
