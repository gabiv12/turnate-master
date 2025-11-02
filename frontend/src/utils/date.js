// src/utils/date.js
export function toIsoNoMs(d) {
  if (!d) return undefined;
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return undefined;
  return x.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function fromIso(iso) {
  return iso ? new Date(iso) : null;
}
