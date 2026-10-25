/* Lokace a jejich značky na mapě */

import { pixelToLatLng, rememberCamera } from "./map.js";
import { iconMeta, iconImgHtml } from "./icons.js";

function listOrNone(items) {
  if (!items || !items.length) return "_None_";
  return items.join(", ");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markerIcon(iconKey) {
  const meta = iconMeta(iconKey);
  return L.divIcon({
    className: "map-pin",
    html: `<div class="map-pin-inner" title="${meta.label}">${iconImgHtml(iconKey, "map-pin-img")}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

export function renderMarkers(ctx) {
  const { state } = ctx;
  state.markersLayer.clearLayers();

  for (const loc of state.locations) {
    const marker = L.marker(pixelToLatLng(loc.x, loc.y), {
      icon: markerIcon(loc.icon),
      keyboard: false,
    });
    marker.bindTooltip(loc.name || "Unnamed");
    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      if (state.placing) return;
      selectLocation(ctx, loc.id, { pan: false });
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
    if (els.btnWikiInfo) els.btnWikiInfo.hidden = true;
    clearWikiResult(els);
    els.locationDetails.innerHTML =
      `<p class="muted">No locations yet. Use Add location, then click the map.</p>`;
    return;
  }

  for (const loc of state.locations) {
    const meta = iconMeta(loc.icon);
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = `${meta.label}: ${loc.name || "Unnamed"}`;
    els.locationSelect.appendChild(opt);
  }

  const stillThere = state.locations.some((l) => l.id === state.selectedLocationId);
  if (!stillThere) {
    state.selectedLocationId = state.locations[0].id;
  }
  els.locationSelect.value = state.selectedLocationId;
  renderLocationDetails(ctx, state.selectedLocationId);
}

export function renderLocationDetails(ctx, locationId) {
  const { state, els } = ctx;
  const loc = state.locations.find((l) => l.id === locationId);

  if (!loc) {
    els.locationDetails.innerHTML = `<p class="muted">No location selected.</p>`;
    els.btnDeleteLocation.hidden = true;
    if (els.btnWikiInfo) els.btnWikiInfo.hidden = true;
    clearWikiResult(els);
    return;
  }

  const meta = iconMeta(loc.icon);
  els.btnDeleteLocation.hidden = false;
  if (els.btnWikiInfo) els.btnWikiInfo.hidden = false;
  els.locationDetails.innerHTML = `
    <h3 class="details-title">${iconImgHtml(loc.icon, "details-icon")} ${escapeHtml(loc.name || "Unnamed")}</h3>
    <p>${escapeHtml(loc.description || "No description")}</p>
    <p><strong>Icon:</strong> ${meta.label}</p>
    <p><strong>Coordinates:</strong> (${loc.x}, ${loc.y})</p>
    <p><strong>Characters</strong><br>${escapeHtml(listOrNone(loc.characters))}</p>
    <p><strong>Units</strong><br>${escapeHtml(listOrNone(loc.units))}</p>
    <p><strong>Monsters</strong><br>${escapeHtml(listOrNone(loc.monsters))}</p>
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
  state.selectedLocationId = locationId;

  if ([...els.locationSelect.options].some((o) => o.value === locationId)) {
    els.locationSelect.value = locationId;
  }
  clearWikiResult(els);
  renderLocationDetails(ctx, locationId);

  if (pan) {
    const loc = state.locations.find((l) => l.id === locationId);
    if (loc) {
      rememberCamera(state);
      state.map.panTo(pixelToLatLng(loc.x, loc.y), { animate: true });
    }
  }
}
