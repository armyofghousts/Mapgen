/* Komunikace s Flask API */

export async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function getState() {
  return api("/api/state");
}

export function selectMap(filename) {
  return api("/api/maps/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
}

export function uploadMap(file) {
  const form = new FormData();
  form.append("file", file);
  return api("/api/maps/upload", { method: "POST", body: form });
}

export function deleteMap(filename) {
  return api(`/api/maps/${encodeURIComponent(filename)}`, { method: "DELETE" });
}

export function createLocation(body) {
  return api("/api/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteLocation(locationId) {
  return api(`/api/locations/${encodeURIComponent(locationId)}`, {
    method: "DELETE",
  });
}

export function loadWikiInfo({ locationId, query } = {}) {
  const params = new URLSearchParams();
  if (locationId) params.set("location_id", locationId);
  if (query) params.set("q", query);
  return api(`/api/wiki?${params.toString()}`);
}
