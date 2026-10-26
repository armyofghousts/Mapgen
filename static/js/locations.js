/* Lokace a jejich značky na mapě */

import { pixelToLatLng, rememberCamera } from "./map.js";
import { iconMeta, iconImgHtml } from "./icons.js";

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markerIcon(iconKey, selected = false) {
  const meta = iconMeta(iconKey);
  const size = selected ? 36 : 26;
  const half = size / 2;
  return L.divIcon({
    className: selected ? "map-pin is-selected" : "map-pin",
    html: `<div class="map-pin-inner" title="${meta.label}">${iconImgHtml(iconKey, "map-pin-img")}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  });
}

export function renderMarkers(ctx) {
  const { state } = ctx;
  if (!state.markersLayer) return;
  state.markersLayer.clearLayers();

  for (const loc of state.locations) {
    const selected = loc.id === state.selectedLocationId;
    const marker = L.marker(pixelToLatLng(loc.x, loc.y), {
      icon: markerIcon(loc.icon, selected),
      keyboard: false,
      zIndexOffset: selected ? 500 : 0,
    });
    marker.bindTooltip(loc.name || "Unnamed");
    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      if (state.placing) return;
      // Clicking the already selected pin clears the selection.
      if (state.selectedLocationId === loc.id) {
        selectLocation(ctx, null, { pan: false });
      } else {
        selectLocation(ctx, loc.id, { pan: false });
      }
    });
    state.markersLayer.addLayer(marker);
  }
}

export function fillLocationSelect(ctx) {
  const { state, els } = ctx;
  els.locationSelect.innerHTML = "";

  if (!state.locations.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No locations yet";
    els.locationSelect.appendChild(opt);
    els.btnDeleteLocation.hidden = true;
    if (els.btnEditLocation) els.btnEditLocation.hidden = true;
    if (els.btnWikiInfo) els.btnWikiInfo.hidden = true;
    clearWikiResult(els);
    els.locationDetails.innerHTML =
      `<p class="muted">No locations yet. Use Add location, then click the map.</p>`;
    return;
  }

  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "No location selected";
  els.locationSelect.appendChild(noneOpt);

  for (const loc of state.locations) {
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = loc.name || "Unnamed";
    els.locationSelect.appendChild(opt);
  }

  const stillThere = state.locations.some((l) => l.id === state.selectedLocationId);
  if (!stillThere) {
    state.selectedLocationId = null;
  }
  els.locationSelect.value = state.selectedLocationId || "";
  renderLocationDetails(ctx, state.selectedLocationId);
  renderMarkers(ctx);
}

export function renderLocationDetails(ctx, locationId) {
  const { state, els } = ctx;
  const loc = state.locations.find((l) => l.id === locationId);

  if (!loc) {
    els.locationDetails.innerHTML = `<p class="muted">No location selected.</p>`;
    els.btnDeleteLocation.hidden = true;
    if (els.btnEditLocation) els.btnEditLocation.hidden = true;
    if (els.btnWikiInfo) els.btnWikiInfo.hidden = true;
    clearWikiResult(els);
    return;
  }

  els.btnDeleteLocation.hidden = false;
  if (els.btnEditLocation) els.btnEditLocation.hidden = false;
  if (els.btnWikiInfo) els.btnWikiInfo.hidden = false;
  els.locationDetails.innerHTML = `
    <h3 class="details-title">${iconImgHtml(loc.icon, "details-icon")} ${escapeHtml(loc.name || "Unnamed")}</h3>
    <p><strong>Personal description</strong><br>${escapeHtml(loc.description || "None")}</p>
  `;
}

export function clearWikiResult(els) {
  if (!els.wikiResult) return;
  els.wikiResult.hidden = true;
  els.wikiResult.innerHTML = "";
  els.wikiResult.classList.remove("wiki-error", "wiki-empty", "wiki-ok");
}

export function renderWikiResult(els, payload) {
  if (!els.wikiResult) return;
  els.wikiResult.hidden = false;
  els.wikiResult.classList.remove("wiki-error", "wiki-empty", "wiki-ok");

  if (!payload.found) {
    els.wikiResult.classList.add("wiki-empty");
    els.wikiResult.innerHTML = `<p class="muted">${escapeHtml(payload.message || "No wiki article found.")}</p>`;
    return;
  }

  els.wikiResult.classList.add("wiki-ok");
  els.wikiResult.innerHTML = `
    <h4>${escapeHtml(payload.title || "Wiki article")}</h4>
    <p>${escapeHtml(payload.description || "")}</p>
    <p><a href="${escapeHtml(payload.url || "#")}" target="_blank" rel="noopener noreferrer">Open on Warhammer Fantasy Wiki</a></p>
  `;
}

export function selectLocation(ctx, locationId, { pan = false } = {}) {
  const { state, els } = ctx;
  state.selectedLocationId = locationId || null;

  const value = state.selectedLocationId || "";
  if ([...els.locationSelect.options].some((o) => o.value === value)) {
    els.locationSelect.value = value;
  }
  clearWikiResult(els);
  renderLocationDetails(ctx, state.selectedLocationId);
  renderMarkers(ctx);

  if (pan && state.selectedLocationId) {
    const loc = state.locations.find((l) => l.id === state.selectedLocationId);
    if (loc) {
      rememberCamera(state);
      state.map.panTo(pixelToLatLng(loc.x, loc.y), { animate: true });
    }
  }
}
