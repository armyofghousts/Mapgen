"""mapgen — Flask + Leaflet fantasy map encyclopedia."""

from __future__ import annotations

from flask import Flask, jsonify, render_template, request, send_from_directory

import storage
import wiki

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB uploads


def api_error(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def build_state() -> dict:
    data = storage.sync_maps_with_disk(storage.load_data())
    storage.save_data(data)
    active = data.get("map_filename")
    maps = []
    for path in storage.list_saved_map_files():
        size = storage.get_image_size(path.name)
        maps.append(
            {
                "filename": path.name,
                "width": size[0] if size else None,
                "height": size[1] if size else None,
            }
        )
    locations = storage.get_locations(data, active)
    return {
        "ok": True,
        "active_map": active,
        "maps": maps,
        "locations": locations,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/state")
def get_state():
    return jsonify(build_state())


@app.post("/api/maps/select")
def select_map():
    body = request.get_json(silent=True) or {}
    filename = body.get("filename")
    if not filename:
        return api_error("filename is required")
    path = storage.MAPS_DIR / filename
    if not path.exists():
        return api_error("Map file not found", 404)
    data = storage.sync_maps_with_disk(storage.load_data())
    data["map_filename"] = filename
    data.setdefault("maps", {}).setdefault(filename, {"locations": []})
    storage.save_data(data)
    return jsonify(build_state())


@app.post("/api/maps/upload")
def upload_map():
    if "file" not in request.files:
        return api_error("No file uploaded")
    file = request.files["file"]
    if not file or not file.filename:
        return api_error("Empty filename")
    try:
        filename = storage.save_uploaded_map(file)
    except ValueError as exc:
        return api_error(str(exc))
    except OSError as exc:
        return api_error(f"Could not save map: {exc}", 500)

    data = storage.sync_maps_with_disk(storage.load_data())
    data["map_filename"] = filename
    data.setdefault("maps", {}).setdefault(filename, {"locations": []})
    storage.save_data(data)
    state = build_state()
    state["uploaded"] = filename
    return jsonify(state)


@app.delete("/api/maps/<path:filename>")
def remove_map(filename: str):
    data = storage.sync_maps_with_disk(storage.load_data())
    if filename not in data.get("maps", {}) and not (storage.MAPS_DIR / filename).exists():
        return api_error("Map not found", 404)
    try:
        storage.delete_map(data, filename)
        storage.save_data(data)
    except OSError as exc:
        return api_error(f"Could not delete map: {exc}", 500)
    return jsonify(build_state())


@app.get("/maps/<path:filename>")
def serve_map_image(filename: str):
    return send_from_directory(storage.MAPS_DIR, filename)


@app.post("/api/locations")
def add_location():
    body = request.get_json(silent=True) or {}
    data = storage.sync_maps_with_disk(storage.load_data())
    active = data.get("map_filename")
    if not active:
        return api_error("No active map", 400)

    name = str(body.get("name") or "").strip()
    if not name:
        return api_error("Name is required")

    try:
        x = int(body.get("x"))
        y = int(body.get("y"))
    except (TypeError, ValueError):
        return api_error("x and y must be integers")

    size = storage.get_image_size(active)
    if size:
        width, height = size
        x = max(0, min(x, width - 1))
        y = max(0, min(y, height - 1))

    loc = storage.create_location(
        data,
        active,
        name=name,
        description=str(body.get("description") or ""),
        x=x,
        y=y,
        icon=storage.normalize_icon(body.get("icon")),
    )
    storage.save_data(data)
    state = build_state()
    state["created"] = loc
    return jsonify(state)


@app.put("/api/locations/<location_id>")
def edit_location(location_id: str):
    body = request.get_json(silent=True) or {}
    data = storage.sync_maps_with_disk(storage.load_data())
    active = data.get("map_filename")
    if not active:
        return api_error("No active map", 400)

    name = str(body.get("name") or "").strip()
    if not name:
        return api_error("Name is required")

    loc = storage.update_location(
        data,
        active,
        location_id,
        name=name,
        description=str(body.get("description") or ""),
        icon=storage.normalize_icon(body.get("icon")),
    )
    if not loc:
        return api_error("Location not found", 404)

    storage.save_data(data)
    state = build_state()
    state["updated"] = loc
    return jsonify(state)


@app.delete("/api/locations/<location_id>")
def remove_location(location_id: str):
    data = storage.sync_maps_with_disk(storage.load_data())
    active = data.get("map_filename")
    if not active:
        return api_error("No active map", 400)
    if not storage.delete_location(data, active, location_id):
        return api_error("Location not found", 404)
    storage.save_data(data)
    return jsonify(build_state())


@app.get("/api/wiki")
def wiki_lookup():
    """Proxy search against Warhammer Fantasy Wiki for a location name."""
    query = (request.args.get("q") or "").strip()
    if not query:
        location_id = (request.args.get("location_id") or "").strip()
        if location_id:
            data = storage.sync_maps_with_disk(storage.load_data())
            active = data.get("map_filename")
            locations = storage.get_locations(data, active)
            match = next((loc for loc in locations if loc.get("id") == location_id), None)
            if not match:
                return api_error("Location not found", 404)
            query = str(match.get("name") or "").strip()

    if not query:
        return api_error("Query q (or location_id) is required")

    try:
        result = wiki.lookup_location(query)
    except wiki.WikiError as exc:
        return api_error(str(exc), 502)
    except Exception as exc:  # noqa: BLE001 — surface unexpected proxy failures cleanly
        return api_error(f"Unexpected wiki error: {exc}", 500)

    return jsonify(result)


if __name__ == "__main__":
    storage.ensure_dirs()
    app.run(debug=True, port=5000)
