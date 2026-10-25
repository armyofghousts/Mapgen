/* Formuláře, toast, ovládání sidebaru a toolbaru */

import * as api from "./api.js";
import { fitWholeMap, rememberCamera } from "./map.js";
import { clearWikiResult, renderWikiResult, selectLocation } from "./locations.js";

export function showToast(els, message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.hidden = true;
  }, 2500);
}

export function setStatus(els, message) {
  els.mapStatus.textContent = message || "";
}

export function setPlacing(ctx, on) {
  const { state, els } = ctx;
  state.placing = on;
  els.btnPlace.classList.toggle("active", on);
  els.btnPlace.textContent = on ? "Cancel placing" : "Add location";
  els.mapEl.classList.toggle("placing", on);
  els.hint.textContent = on
    ? "Placing mode: click on the map to choose a location (dragging is off)."
    : "Drag to pan · scroll to zoom · Add location, then click the map";

  // While placing, disable pan so a click registers as a pin, not a drag.
  if (state.map) {
    if (on) {
      state.map.dragging.disable();
      state.map.boxZoom.disable();
      if (state.map.tap) state.map.tap.disable();
    } else {
      state.map.dragging.enable();
      state.map.boxZoom.enable();
      if (state.map.tap) state.map.tap.enable();
    }
  }
}

export function openLocationDialog(ctx, x, y) {
  const { els } = ctx;
  els.clickCoords.textContent = `Clicked at (${x}, ${y})`;
  els.locName.value = "";
  els.setLocIcon("alert");
  els.locDescription.value = "";
  els.locCharacters.value = "";
  els.locUnits.value = "";
  els.locMonsters.value = "";
  els.dialog.hidden = false;
  els.locName.focus();
}

export function closeLocationDialog(ctx) {
  const { state, els } = ctx;
  els.dialog.hidden = true;
  state.pendingClick = null;
}

function linesToList(text) {
  return text
    .replaceAll(",", "\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function fillMapSelect(ctx) {
  const { state, els } = ctx;
  const previous = state.activeMap;
  els.mapSelect.innerHTML = "";

  if (!state.maps.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No maps yet";
    els.mapSelect.appendChild(opt);
    return;
  }

  for (const map of state.maps) {
    const opt = document.createElement("option");
    opt.value = map.filename;
    opt.textContent = map.filename;
    if (map.filename === previous) opt.selected = true;
    els.mapSelect.appendChild(opt);
  }
}

export function bindEvents(ctx) {
  const { state, els } = ctx;

  els.mapSelect.addEventListener("change", async () => {
    const filename = els.mapSelect.value;
    if (!filename || filename === state.activeMap) return;
    try {
      rememberCamera(state);
      const payload = await api.selectMap(filename);
      ctx.applyState(payload, { fitMap: true, preserveCamera: false });
      showToast(els, `Switched to ${filename}`);
    } catch (err) {
      showToast(els, err.message);
    }
  });

  els.mapUpload.addEventListener("change", async () => {
    const file = els.mapUpload.files && els.mapUpload.files[0];
    if (!file) return;
    try {
      setStatus(els, "Uploading…");
      const payload = await api.uploadMap(file);
      ctx.applyState(payload, { fitMap: true, preserveCamera: false });
      showToast(els, `Uploaded ${payload.uploaded}`);
    } catch (err) {
      showToast(els, err.message);
      setStatus(els, err.message);
    } finally {
      els.mapUpload.value = "";
    }
  });

  els.btnDeleteMap.addEventListener("click", async () => {
    if (!state.activeMap) return;
    if (!confirm(`Delete map “${state.activeMap}” and its locations?`)) return;
    try {
      const payload = await api.deleteMap(state.activeMap);
      ctx.applyState(payload, { fitMap: true, preserveCamera: false });
      showToast(els, "Map deleted");
    } catch (err) {
      showToast(els, err.message);
    }
  });

  els.locationSelect.addEventListener("change", () => {
    rememberCamera(state);
    selectLocation(ctx, els.locationSelect.value, { pan: false });
  });

  els.btnDeleteLocation.addEventListener("click", async () => {
    if (!state.selectedLocationId) return;
    if (!confirm("Delete this location?")) return;
    try {
      rememberCamera(state);
      const payload = await api.deleteLocation(state.selectedLocationId);
      state.selectedLocationId = null;
      ctx.applyState(payload, { preserveCamera: true });
      showToast(els, "Location deleted");
    } catch (err) {
      showToast(els, err.message);
    }
  });

  if (els.btnWikiInfo) {
    els.btnWikiInfo.addEventListener("click", async () => {
      if (!state.selectedLocationId) {
        showToast(els, "Select a location first");
        return;
      }
      const loc = state.locations.find((l) => l.id === state.selectedLocationId);
      if (!loc) {
        showToast(els, "Select a location first");
        return;
      }

      els.btnWikiInfo.disabled = true;
      els.btnWikiInfo.textContent = "Loading…";
      clearWikiResult(els);
      try {
        const payload = await api.loadWikiInfo({ locationId: loc.id, query: loc.name });
        renderWikiResult(els, payload);
        if (!payload.found) {
          showToast(els, "No matching wiki article");
        }
      } catch (err) {
        if (els.wikiResult) {
          els.wikiResult.hidden = false;
          els.wikiResult.classList.add("wiki-error");
          els.wikiResult.innerHTML = `<p>${err.message}</p>`;
        }
        showToast(els, err.message);
      } finally {
        els.btnWikiInfo.disabled = false;
        els.btnWikiInfo.textContent = "Load Wiki Info";
      }
    });
  }

  els.btnReset.addEventListener("click", () => {
    fitWholeMap(state);
  });

  els.btnPlace.addEventListener("click", () => {
    if (state.placing) {
      setPlacing(ctx, false);
      closeLocationDialog(ctx);
    } else {
      if (!state.activeMap) {
        showToast(els, "Upload or select a map first");
        return;
      }
      setPlacing(ctx, true);
    }
  });

  els.btnCancelForm.addEventListener("click", () => {
    closeLocationDialog(ctx);
    setPlacing(ctx, false);
  });

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.pendingClick) return;

    const body = {
      name: els.locName.value.trim(),
      description: els.locDescription.value,
      x: state.pendingClick.x,
      y: state.pendingClick.y,
      icon: els.getLocIcon(),
      characters: linesToList(els.locCharacters.value),
      units: linesToList(els.locUnits.value),
      monsters: linesToList(els.locMonsters.value),
    };
    if (!body.name) {
      showToast(els, "Name is required");
      return;
    }

    try {
      rememberCamera(state);
      const payload = await api.createLocation(body);
      closeLocationDialog(ctx);
      setPlacing(ctx, false);
      state.selectedLocationId = payload.created && payload.created.id;
      ctx.applyState(payload, { preserveCamera: true });
      showToast(els, `Saved “${body.name}”`);
    } catch (err) {
      showToast(els, err.message);
    }
  });

  // Click on the dark backdrop closes the form.
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) {
      closeLocationDialog(ctx);
      setPlacing(ctx, false);
    }
  });
}
