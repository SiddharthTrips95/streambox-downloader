const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function parseErrorResponse(res) {
  try {
    const data = await res.json();
    return data.message || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function checkBackendHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend unreachable');
  return res.json();
}

export async function fetchVideoMetadata(url) {
  const res = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.json();
}

export async function startDownloadJob({ url, format, quality, title }) {
  const res = await fetch(`${API_BASE}/downloads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, format, quality, title }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.json();
}

export function subscribeToDownloadEvents(jobId, { onUpdate, onError }) {
  const es = new EventSource(`${API_BASE}/downloads/${encodeURIComponent(jobId)}/events`);

  es.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onUpdate?.(payload);
      if (payload.status === 'completed' || payload.status === 'error') {
        es.close();
      }
    } catch {
      // Ignore malformed SSE keepalive frames
    }
  };

  es.onerror = () => {
    es.close();
    onError?.('Lost live progress connection to the server.');
  };

  return () => es.close();
}

export function getDownloadFileUrl(jobId) {
  return `${API_BASE}/downloads/${encodeURIComponent(jobId)}/file`;
}

export async function cancelDownloadJob(jobId) {
  try {
    await fetch(`${API_BASE}/downloads/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Best-effort cancellation
  }
}
