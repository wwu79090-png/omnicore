export function safeParse(json, fallback = null) {
  if (typeof json !== 'string') return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

const Data = { safeParse };

export default Data;
