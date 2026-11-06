export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// Status names contain spaces ("Out for Delivery"); this makes one CSS class from them.
export const statusClass = (s) => String(s).replace(/\s+/g, '-');

export const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// Downloads an authenticated file (e.g. a CSV export) by fetching it and saving the blob.
export async function download(path, filename, token) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Download failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
