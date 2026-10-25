/* Leaflet mapa — pan, zoom, načtení obrázku */

const MAX_ZOOM = 4;
const MIN_ZOOM_FALLBACK = -6;
// 0 = zoom-out limit is exactly "whole map fits" (no extra gray, no inset).
const MIN_ZOOM_INSET = 0;

export function pixelToLatLng(x, y) {
  return [-y, x];
}

export function latLngToPixel(lat, lng, width, height) {
  let x = Math.round(lng);
  let y = Math.round(-lat);
  x = Math.max(0, Math.min(x, width - 1));
  y = Math.max(0, Math.min(y, height - 1));
  return { x, y };
}

function imageBounds(width, height) {
  return [
    [-height, 0],
    [0, width],
  ];
}

function maxBounds(width, height) {
  const padX = Math.round(width * 0.12);
  const padY = Math.round(height * 0.12);
  return [
    [-height - padY, -padX],
    [padY, width + padX],
  ];
}

export function rememberCamera(state) {
  if (!state.map) return;
  state.savedCenter = state.map.getCenter();
  state.savedZoom = state.map.getZoom();
}

export function initMap(ctx) {
  const { state, els } = ctx;

  state.map = L.map(els.mapEl, {
    crs: L.CRS.Simple,
    minZoom: MIN_ZOOM_FALLBACK,
    maxZoom: MAX_ZOOM,
    zoomControl: true,
    attributionControl: false,
  });
  state.markersLayer = L.layerGroup().addTo(state.map);

  state.map.on("moveend", () => rememberCamera(state));
  state.map.on("zoomend", () => rememberCamera(state));

  state.map.on("click", (event) => {
    if (!state.placing || !state.activeMap) return;
    L.DomEvent.stopPropagation(event);
    const { x, y } = latLngToPixel(
      event.latlng.lat,
      event.latlng.lng,
      state.width,
      state.height
    );
    state.pendingClick = { x, y };
    ctx.ui.openLocationDialog(ctx, x, y);
  });
}

export function clearMapLayers(state) {
  if (state.imageOverlay) {
    state.map.removeLayer(state.imageOverlay);
    state.imageOverlay = null;
  }
  if (state.border) {
    state.map.removeLayer(state.border);
    state.border = null;
  }
  if (state.markersLayer) {
    state.markersLayer.clearLayers();
  }
}

/** Zoom level where the full image just fits in the map pane. */
function wholeMapZoom(state) {
  state.map.invalidateSize();
  const bounds = imageBounds(state.width, state.height);
  const pad = L.point(12, 12);
  return state.map.getBoundsZoom(bounds, false, pad);
}

function minZoomForImage(state) {
  const fitZ = wholeMapZoom(state);
  return Math.min(MAX_ZOOM, fitZ + MIN_ZOOM_INSET);
}

/**
 * Reset / start view at the zoom-out limit (a bit closer than pure fit).
 */
export function fitWholeMap(state) {
  if (!state.width || !state.height || !state.map) return;

  state.map.invalidateSize();
  const minZoom = minZoomForImage(state);
  state.map.setMinZoom(minZoom);
  state.map.setMaxZoom(MAX_ZOOM);

  const center = [-state.height / 2, state.width / 2];
  state.map.setView(center, minZoom);
  rememberCamera(state);
}

export function loadMapImage(ctx, mapInfo, { fit = false } = {}) {
  const { state } = ctx;
  clearMapLayers(state);

  if (!mapInfo || !mapInfo.filename || !mapInfo.width || !mapInfo.height) {
    return;
  }

  state.width = mapInfo.width;
  state.height = mapInfo.height;
  const bounds = imageBounds(state.width, state.height);
  const url = `/maps/${encodeURIComponent(mapInfo.filename)}`;

  state.imageOverlay = L.imageOverlay(url, bounds, {
    opacity: 1,
    interactive: false,
  }).addTo(state.map);

  state.border = L.rectangle(bounds, {
    color: "#555555",
    weight: 2,
    fill: false,
    opacity: 0.85,
    interactive: false,
  }).addTo(state.map);

  state.map.setMaxBounds(maxBounds(state.width, state.height));
  state.map.options.maxBoundsViscosity = 1.0;

  const applyView = () => {
    if (fit || !state.savedCenter) {
      fitWholeMap(state);
      return;
    }
    const minZ = minZoomForImage(state);
    state.map.setMinZoom(minZ);
    const zoom = Math.max(state.savedZoom ?? minZ, minZ);
    state.map.setView(state.savedCenter, zoom);
  };

  state.map.invalidateSize();
  applyView();
  setTimeout(() => {
    state.map.invalidateSize();
    applyView();
  }, 100);

  ctx.locations.renderMarkers(ctx);
}
