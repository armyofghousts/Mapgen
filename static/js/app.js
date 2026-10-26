/* Spuštění aplikace — skládá API, mapu, lokace a UI */

import * as api from "./api.js";
import * as map from "./map.js";
import * as locations from "./locations.js";
import * as ui from "./ui.js";

const els = {
  mapSelect: document.getElementById("map-select"),
  locationSelect: document.getElementById("location-select"),
  locationDetails: document.getElementById("location-details"),
  mapStatus: document.getElementById("map-status"),
  mapUpload: document.getElementById("map-upload"),
  btnDeleteMap: document.getElementById("btn-delete-map"),
  btnDeleteLocation: document.getElementById("btn-delete-location"),
  btnEditLocation: document.getElementById("btn-edit-location"),
  btnWikiInfo: document.getElementById("btn-wiki-info"),
  wikiResult: document.getElementById("wiki-result"),
  btnReset: document.getElementById("btn-reset"),
  btnPlace: document.getElementById("btn-place"),
  hint: document.getElementById("hint"),
  toast: document.getElementById("toast"),
  dialog: document.getElementById("location-dialog"),
  form: document.getElementById("location-form"),
  formTitle: document.getElementById("location-form-title"),
  clickCoords: document.getElementById("click-coords"),
  locName: document.getElementById("loc-name"),
  locIconRadios: () => document.querySelectorAll('input[name="loc-icon"]'),
  getLocIcon: () => {
    const checked = document.querySelector('input[name="loc-icon"]:checked');
    return checked ? checked.value : "alert";
  },
  setLocIcon: (value) => {
    const radio = document.querySelector(`input[name="loc-icon"][value="${value}"]`);
    if (radio) radio.checked = true;
  },
  locDescription: document.getElementById("loc-description"),
  btnCancelForm: document.getElementById("btn-cancel-form"),
  mapEl: document.getElementById("map"),
};

const state = {
  activeMap: null,
  maps: [],
  locations: [],
  selectedLocationId: null,
  editingLocationId: null,
  placing: false,
  pendingClick: null,
  map: null,
  imageOverlay: null,
  border: null,
  markersLayer: null,
  width: 0,
  height: 0,
  savedCenter: null,
  savedZoom: null,
};

const ctx = {
  state,
  els,
  api,
  map,
  locations,
  ui,
  applyState,
};

function applyState(payload, { fitMap = false, preserveCamera = true } = {}) {
  const previousMap = state.activeMap;
  state.activeMap = payload.active_map;
  state.maps = payload.maps || [];
  state.locations = payload.locations || [];

  ui.fillMapSelect(ctx);
  locations.fillLocationSelect(ctx);

  const mapInfo = state.maps.find((m) => m.filename === state.activeMap) || null;
  const mapChanged = previousMap !== state.activeMap;

  if (!preserveCamera || mapChanged || fitMap) {
    state.savedCenter = null;
    state.savedZoom = null;
  }

  if (!mapInfo) {
    map.clearMapLayers(state);
    ui.setStatus(els, "Upload a map to get started.");
    return;
  }

  ui.setStatus(els, `Active: ${mapInfo.filename}`);
  map.loadMapImage(ctx, mapInfo, {
    fit: mapChanged || fitMap || !state.savedCenter,
  });
}

async function refreshState(options = {}) {
  const payload = await api.getState();
  applyState(payload, options);
}

async function boot() {
  map.initMap(ctx);
  ui.bindEvents(ctx);

  try {
    await refreshState({ fitMap: true, preserveCamera: false });
  } catch (err) {
    ui.setStatus(els, err.message);
    ui.showToast(els, err.message);
  }

  setTimeout(() => state.map.invalidateSize(), 50);
}

boot();
