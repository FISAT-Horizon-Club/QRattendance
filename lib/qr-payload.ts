// The QR code only carries a string. Both pages use these two functions so
// the format can never drift apart.

export function buildQrPayload(studentId: string): string {
  return JSON.stringify({ student_id: studentId });
}

export function parseQrPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "student_id" in parsed &&
      typeof parsed.student_id === "string" &&
      parsed.student_id.trim()
    ) {
      return parsed.student_id.trim();
    }
  } catch {
    // Not JSON, so fall through and treat the whole QR text as a student ID.
  }

  return text;
}
