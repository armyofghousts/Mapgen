"""Local JSON + image storage for mapgen (shared by Flask app)."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from PIL import Image

DATA_DIR = Path(__file__).parent / "data"
MAPS_DIR = DATA_DIR / "maps"
DATA_FILE = DATA_DIR / "map_data.json"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
LOCATION_ICONS = ("house", "castle", "dragon", "forest", "alert")


def normalize_icon(value: str | None) -> str:
    icon = str(value or "").strip().lower()
    if icon in LOCATION_ICONS:
        return icon
    return "alert"


def ensure_dirs() -> None:
    MAPS_DIR.mkdir(parents=True, exist_ok=True)


def default_data() -> dict:
    return {"map_filename": None, "maps": {}}


def list_saved_map_files() -> list[Path]:
    ensure_dirs()
    files = [
        p
        for p in MAPS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS
    ]
    return sorted(files, key=lambda p: p.name.lower())


def migrate_data(raw: dict) -> dict:
    """Support older single-map JSON and normalize to multi-map format."""
    data = default_data()
    data["map_filename"] = raw.get("map_filename")
    maps = raw.get("maps")
    if isinstance(maps, dict):
        data["maps"] = maps
    if "locations" in raw and isinstance(raw["locations"], list):
        filename = data["map_filename"]
        if filename:
            data["maps"].setdefault(filename, {"locations": raw["locations"]})
    for path in list_saved_map_files():
        data["maps"].setdefault(path.name, {"locations": []})
    return data


def load_data() -> dict:
    ensure_dirs()
    if not DATA_FILE.exists():
        return default_data()
    try:
        with DATA_FILE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            raise ValueError("Data file is not a JSON object.")
        return migrate_data(raw)
    except (json.JSONDecodeError, OSError, ValueError):
        return default_data()


def save_data(data: dict) -> None:
    ensure_dirs()
    payload = {
        "map_filename": data.get("map_filename"),
        "maps": data.get("maps", {}),
    }
    with DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def get_locations(data: dict, filename: str | None) -> list[dict]:
    if not filename:
        return []
    maps = data.setdefault("maps", {})
    entry = maps.setdefault(filename, {"locations": []})
    locs = entry.get("locations")
    if not isinstance(locs, list):
        entry["locations"] = []
        return entry["locations"]
    return locs


def set_locations(data: dict, filename: str | None, locations: list[dict]) -> None:
    if not filename:
        return
    data.setdefault("maps", {})[filename] = {"locations": locations}


def parse_list_field(value) -> list[str]:
    """Accept a list, or a string with newlines/commas."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value)
    items: list[str] = []
    for line in text.replace(",", "\n").splitlines():
        item = line.strip()
        if item:
            items.append(item)
    return items


def unique_map_filename(original_name: str) -> str:
    stem = Path(original_name).stem
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        suffix = ".png"
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", stem).strip("_")[:40] or "map"
    candidate = f"{safe}{suffix}"
    n = 1
    while (MAPS_DIR / candidate).exists():
        candidate = f"{safe}_{n}{suffix}"
        n += 1
    return candidate


def save_uploaded_map(file_storage) -> str:
    """Save an uploaded Werkzeug FileStorage; return stored filename."""
    original = file_storage.filename or "map.png"
    suffix = Path(original).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError("Only PNG or JPG images are allowed.")
    filename = unique_map_filename(original)
    path = MAPS_DIR / filename
    image = Image.open(file_storage.stream)
    image = image.convert("RGB")
    image.save(path)
    return filename


def get_image_size(filename: str) -> tuple[int, int] | None:
    path = MAPS_DIR / filename
    if not path.exists():
        return None
    try:
        with Image.open(path) as img:
            return img.size
    except OSError:
        return None


def sync_maps_with_disk(data: dict) -> dict:
    """Ensure JSON has an entry for every image file on disk."""
    names = {p.name for p in list_saved_map_files()}
    maps = data.setdefault("maps", {})
    for name in names:
        maps.setdefault(name, {"locations": []})
    # Drop JSON entries whose files are gone.
    for name in list(maps.keys()):
        if name not in names:
            maps.pop(name, None)
    active = data.get("map_filename")
    if active not in names:
        data["map_filename"] = next(iter(sorted(names)), None)
    return data


def create_location(
    data: dict,
    filename: str,
    *,
    name: str,
    description: str,
    x: int,
    y: int,
    characters: list[str],
    units: list[str],
    monsters: list[str],
    icon: str = "alert",
) -> dict:
    loc = {
        "id": str(uuid.uuid4()),
        "name": name.strip(),
        "description": description.strip(),
        "x": int(x),
        "y": int(y),
        "icon": normalize_icon(icon),
        "characters": characters,
        "units": units,
        "monsters": monsters,
    }
    locations = get_locations(data, filename)
    locations.append(loc)
    set_locations(data, filename, locations)
    return loc


def delete_location(data: dict, filename: str, location_id: str) -> bool:
    locations = get_locations(data, filename)
    new_locs = [loc for loc in locations if loc.get("id") != location_id]
    if len(new_locs) == len(locations):
        return False
    set_locations(data, filename, new_locs)
    return True


def delete_map(data: dict, filename: str) -> dict:
    path = MAPS_DIR / filename
    if path.exists():
        path.unlink()
    data.setdefault("maps", {}).pop(filename, None)
    remaining = [p.name for p in list_saved_map_files()]
    if data.get("map_filename") == filename:
        data["map_filename"] = remaining[0] if remaining else None
    return data
