# mapgen

A simple **Flask + Leaflet** fantasy map encyclopedia.

Upload map images, pan/zoom without page reloads, place locations and store everything locally as JSON.

## Features

- Upload PNG/JPG maps
- Choose among saved maps in `data/maps/`
- Pan and zoom with Leaflet (camera stays put when selecting locations)
- Add locations by clicking the map (after **Add location**)
- Delete maps or locations
- All data stays in local JSON — no database

## Requirements

- Python 3.10+ (tested with 3.13)
- Virtual environment recommended (`.venv`)

## Setup

```powershell
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
4. Fill in the form and click save.
5. Select a location in the sidebar to view details.

