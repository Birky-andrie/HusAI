// Web dev: empty base + Vite proxy. Electron (file://) and deployed web MUST set
// VITE_API_BASE_URL at build time — relative /api has no origin under file://.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function postJSON(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`;
    try {
      const data = await resp.json();
      if (data.message) message = data.message;
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}
