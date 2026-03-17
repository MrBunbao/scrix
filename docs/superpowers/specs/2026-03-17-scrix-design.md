# Scrix Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Author:** admad + Claude

## Overview

Scrix is a fork of [Strix](https://github.com/eduard256/Strix) — an IP camera stream discovery tool — adapted to work with Scrypted NVR instead of Frigate. It discovers working video streams from IP cameras across 67,288 models and 3,636 brands, then pushes them directly into a Scrypted NVR instance.

The project consists of two components:

1. **Scrix Container** — Docker container running the Go discovery engine + Vue.js web UI (forked from Strix)
2. **scrypted-scrix Plugin** — Thin TypeScript Scrypted plugin that receives API calls and creates camera devices

## Goals

- General-purpose camera stream discovery tool for Scrypted NVR users
- Preserve Strix's proven discovery engine (67K camera models, ONVIF, 102K URL patterns)
- Seamless "discover → add to Scrypted" workflow from a single web UI
- Distributable: Docker image on Docker Hub, npm package for the Scrypted plugin
- Strip all Frigate references — this is Scrypted-only

## Non-Goals

- Porting the Go discovery engine to TypeScript
- Building a UI inside Scrypted's management console
- Supporting Frigate or any other NVR
- Guaranteeing discovery works on locked-down cameras (e.g., Reolink E1 base model)

## System Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────┐
│   Scrix Container (Docker)  │     │   Scrypted Instance      │
│                             │     │                          │
│  ┌───────────────────────┐  │     │  ┌────────────────────┐  │
│  │  Go Backend           │  │     │  │ scrypted-scrix     │  │
│  │  - Stream discovery   │  │     │  │ plugin (TypeScript) │  │
│  │  - Camera database    │  │     │  │                    │  │
│  │  - ONVIF + ffprobe    │  │     │  │ - HttpRequestHandler│  │
│  │  - REST API + SSE     │  │     │  │ - DeviceProvider    │  │
│  └───────────┬───────────┘  │     │  │ - Creates RTSP cams │  │
│              │              │     │  │ - Enables NVR/det.  │  │
│  ┌───────────▼───────────┐  │     │  └─────────▲──────────┘  │
│  │  Vue.js Web UI        │  │     │            │             │
│  │  - Discovery panel    │  │     │            │             │
│  │  - Stream selection   │──┼─────┼── HTTP POST│             │
│  │  - Scrypted settings  │  │     │   (Add Camera)          │
│  │  - Add to Scrypted    │  │     │                          │
│  └───────────────────────┘  │     └──────────────────────────┘
└─────────────────────────────┘
         Port 4567                        Port 10443
```

## Component 1: Scrypted Plugin (`scrypted-scrix`)

### Purpose

Thin API receiver that creates camera devices in Scrypted when called by the Scrix container.

### Interfaces

- `HttpRequestHandler` — exposes REST endpoints
- `DeviceProvider` — manages cameras it creates
- `Settings` — plugin-level settings (API key)

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/cameras` | Create a camera with discovered streams |
| `GET` | `/api/status` | Health check + available detection plugins |
| `DELETE` | `/api/cameras/:id` | Remove a Scrix-created camera |

### POST `/api/cameras` Payload

```json
{
  "name": "Back Yard Camera",
  "ip": "192.168.1.100",
  "streams": {
    "main": "rtsp://admin:pass@192.168.1.100/live/main",
    "sub": "rtsp://admin:pass@192.168.1.100/live/sub"
  },
  "username": "admin",
  "password": "pass",
  "options": {
    "enableNvr": true,
    "enableDetection": true,
    "detectionTypes": ["person", "vehicle", "animal"]
  }
}
```

### Camera Creation Flow

1. Create RTSP camera device via `deviceManager.onDeviceDiscovered()`
2. Set `storage["urls"]` with stream URL array (main first, sub second)
3. Set `storage["username"]` and `storage["password"]`
4. If `enableNvr` — attach NVR mixin to device
5. If `enableDetection` — attach object detection mixin with selected types

### Authentication

Shared API key generated on plugin install, displayed in plugin settings. User copies it into Scrix's settings page. Bearer token in `Authorization` header.

## Component 2: Scrix Container (Strix Fork)

### Retained From Strix (Untouched)

- Go backend: discovery engine, camera database, ONVIF, stream testing, ffprobe, SSE
- REST API: `/api/v1/health`, `/api/v1/cameras/search`, `/api/v1/streams/discover`
- Camera brand JSON files (`data/brands/` — 3,636 files)
- Docker multi-stage Alpine build
- Core web UI: discovery panel, stream filtering, real-time progress

### Removed From Strix

- `webui/web/js/config-generators/frigate/` — Frigate config generator
- `webui/web/js/config-generators/go2rtc/` — go2rtc config generator
- `FRIGATE_RECORD_CONFIG.md` and Frigate-specific docs
- `docker-compose.full.yml` (Frigate full-stack compose)

### Added to Scrix

#### Scrypted Settings Page (Vue Component)

First-run setup UI:
- Scrypted host URL field (e.g., `https://10.10.10.10:10443`)
- API key field (copied from Scrypted plugin settings)
- "Test Connection" button — calls plugin's `GET /api/status`
- Settings persisted to `/config/scrix.json` (Docker volume)

#### "Add to Scrypted" Panel (Vue Component)

Replaces Frigate config generator. Shown after stream discovery:
- Main stream + optional sub stream selector (same UX as Strix)
- Camera name field (auto-generated from IP, editable)
- Checkbox: Enable NVR (default on)
- Checkbox: Enable Detection (default on)
- Detection type multi-select: person, vehicle, animal, package (all on by default)
- "Add to Scrypted" button
- Success/error feedback inline

#### Backend Proxy Endpoint

`POST /api/v1/scrypted/add` — Go handler that forwards camera creation request to the Scrypted plugin. Avoids CORS issues (browser → Scrix backend → Scrypted plugin).

#### Config File (`/config/scrix.json`)

```json
{
  "scrypted": {
    "host": "https://10.10.10.10:10443",
    "apiKey": "sk_abc123..."
  }
}
```

## Data Flow

```
1. INSTALL
   docker compose up -d          →  Scrix running on :4567
   Scrypted UI → Install Plugin  →  scrypted-scrix active
   Copy API key from plugin      →  Paste into Scrix settings

2. DISCOVER
   User opens http://host:4567
   Enters camera IP, optional model/credentials
   Clicks "Discover Streams"
   Go backend: ONVIF → DB lookup → popular patterns (20 workers, ~650 URLs)
   SSE streams results to UI in real-time

3. CONFIGURE
   User selects main + sub stream
   Names camera, checks NVR/detection options
   Clicks "Add to Scrypted"

4. CREATE
   Browser → POST /api/v1/scrypted/add (Scrix backend)
   Scrix backend → POST /endpoint/scrypted-scrix/api/cameras (plugin)
   Plugin creates RTSP device, sets URLs, attaches mixins
   Returns { id, name, status: "created" }
   UI shows success confirmation

5. DONE
   Camera appears in Scrypted NVR with recording + detection active
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Scrypted unreachable | "Cannot connect to Scrypted. Check settings." |
| Plugin not installed | `GET /api/status` returns 404 → "Install the scrypted-scrix plugin first." |
| Invalid API key | 401 → "API key rejected. Check plugin settings." |
| Camera creation fails | Plugin returns error detail → displayed in UI |
| Duplicate camera (same IP) | Plugin warns, user confirms or cancels |

## Deployment

### Docker Compose

```yaml
services:
  scrix:
    image: scrix/scrix:latest
    container_name: scrix
    ports:
      - "4567:4567"
    volumes:
      - scrix-config:/config
    environment:
      - SCRIX_LOG_LEVEL=info
    restart: unless-stopped
    network_mode: host

volumes:
  scrix-config:
```

`network_mode: host` required for LAN camera probing (RTSP, ONVIF, ffprobe) and Scrypted connectivity.

### Plugin Install

Scrypted management console → Install Plugin → enter `scrypted-scrix` → done.

## Distribution

| Artifact | Location |
|----------|----------|
| Docker image | `scrix/scrix` on Docker Hub |
| npm package | `scrypted-scrix` on npm |
| Source code | `github.com/MrBunbao/scrix` |

## Testing Strategy

### Scrix Container

- Existing Strix discovery tests (come with fork)
- New: `POST /api/v1/scrypted/add` — mock plugin, verify payload forwarding
- New: Settings persistence — write/read `/config/scrix.json`
- New: Connection test — mock `GET /api/status` responses (success, 404, 401, timeout)
- Frontend: manual testing of Vue components

### Scrypted Plugin

- Unit: camera creation logic — verify `deviceManager` calls, storage keys, mixin attachments
- Integration: test against real Scrypted instance, verify camera appears
- Error paths: missing fields, invalid streams, duplicate cameras

### End-to-End

- Discover stream on a real camera
- Add to Scrypted via UI
- Verify camera in Scrypted NVR with recording/detection enabled

## Naming

- **Project:** Scrix (Scrypted + Strix)
- **Docker:** `scrix/scrix`
- **npm:** `scrypted-scrix`
- **GitHub:** `MrBunbao/scrix`
