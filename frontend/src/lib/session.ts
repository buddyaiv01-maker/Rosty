// One id per browser tab/visit (sessionStorage, not localStorage) — groups
// interaction_events into "one sitting" for future sequence-aware recommendations.
// See RECOMMENDATIONS.md.

const SESSION_ID_KEY = "lanstream.sessionId";

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}
