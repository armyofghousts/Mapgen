# mapgen

A simple **Flask + Leaflet** warhammer fantasy map encyclopedia.

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


## Example Run

Start the application:

```bash
python app.py
```

Open `http://127.0.0.1:5000` in your browser.

Select a location named **Lothern** and click **Load Wiki Info**.

### Example API Request

```http
GET http://127.0.0.1:5000/api/wiki?q=Lothern
```

### Example API Response

```json
{
  "description": "Lothern is the greatest and largest city of Ulthuan , the island-continent of the High Elves . Situated within the Kingdom of Eataine , Lothern is the capital city of both that kingdom and Ulthuan itself. Human merchants are allowed to trade here, and the city has been a busy centre of international trade since the beginning of Phoenix King Finubar 's reign in 2163 IC . Home to several thousand High Elves, this grea\u2026",
  "found": true,
  "ok": true,
  "pageid": 3780,
  "query": "Lothern",
  "title": "Lothern",
  "url": "https://warhammerfantasy.fandom.com/wiki/Lothern"
}
```

## Environment Variables

The Warhammer Fantasy Wiki API does not require an API key.

The following optional environment variables can be used to configure the Wiki integration:

- `WIKI_API_URL` – Wiki API endpoint.
- `WIKI_TIMEOUT` – Request timeout.
- `WIKI_MAX_RETRIES` – Maximum number of retries.
- `WIKI_USER_AGENT` – User-Agent sent with API requests.

The application uses default values if these variables are not configured.
