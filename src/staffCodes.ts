// Staff access codes are shared with every visitor through the sheet's Settings,
// so only their SHA-256 hashes are stored there, never the codes themselves.
export const hashStaffCode = async (code: string): Promise<string> => {
  const data = new TextEncoder().encode(`fst-staff:${code.trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
};

export const parseStaffCodeHashes = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};
