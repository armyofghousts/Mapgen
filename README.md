# mapgen

A simple **Flask + Leaflet** fantasy map encyclopedia for a school project.

Upload map images, pan/zoom without page reloads, place locations with characters, units and monsters, and store everything locally as JSON.

## Why Flask (not Streamlit)

Streamlit reruns the whole script on many interactions, which made the map feel like it was constantly refreshing. Flask serves a normal HTML/JS page: the Leaflet map stays alive while data is loaded through small `fetch` API calls.

## Features

- Upload PNG/JPG maps
- Choose among saved maps in `data/maps/`
- Pan and zoom with Leaflet (camera stays put when selecting locations)
- Add locations by clicking the map (after **Add location**)
- Each location: name, description, characters, units, monsters
- Delete maps or locations
- All data stays in local JSON — no database

## Project structure

```
mapgen/
├── app.py                 # Flask server + REST API
├── storage.py             # Load/save JSON and map images
├── templates/
│   └── index.html         # Single-page UI
├── static/
│   ├── css/style.css
│   └── js/
│       ├── app.js         # Spuštění aplikace
│       ├── map.js         # Leaflet mapa
│       ├── locations.js   # Lokace a značky
│       ├── api.js         # Komunikace s Flaskem
│       └── ui.js          # Formuláře a ovládání
├── data/
│   ├── map_data.json      # Active map + locations per map
│   └── maps/              # Uploaded images
├── requirements.txt
└── README.md
```

## Requirements

- Python 3.10+ (tested with 3.13)
- Virtual environment recommended (`.venv`)

## Setup

```powershell
cd mapgen
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```powershell
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

## How to use

1. Upload a map (or pick one from **Saved maps**).
2. Drag to pan, scroll to zoom, **Reset view** to fit the whole map.
3. Click **Add location**, then click a point on the map.
4. Fill in name / description / characters / units / monsters and save.
5. Select a location in the sidebar to view details (map view does not reset).

## API (used by the frontend)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/state` | Active map, map list, locations |
| POST | `/api/maps/upload` | Upload image (`multipart/form-data`, field `file`) |
| POST | `/api/maps/select` | `{ "filename": "…" }` |
| DELETE | `/api/maps/<filename>` | Delete map + its locations |
| GET | `/maps/<filename>` | Serve map image |
| POST | `/api/locations` | Create location JSON |
| DELETE | `/api/locations/<id>` | Delete location |

## Data storage

| Path | Contents |
|------|----------|
| `data/maps/` | Map images |
| `data/map_data.json` | `map_filename` + `maps.<file>.locations` |

Existing Streamlit-era data in this folder is reused as-is.
