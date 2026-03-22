export function buildId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function isRateLimitError(error) {
  const rawCode = error?.status ?? error?.statusCode ?? error?.code ?? "";
  const code = String(rawCode).toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "429" ||
    code === "too_many_requests" ||
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

export function filterNotes(notes, search) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return notes;
  }

  return notes.filter((note) => {
    const haystack = `${note.title} ${note.body}`.toLowerCase();
    return haystack.includes(query);
  });
}