# Scrix Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Author:** admad + Claude

## Overview

Scrix is a fork of [Strix](https://github.com/eduard256/Strix) — an IP camera stream discovery tool — adapted to work with Scrypted NVR instead of Frigate. It discovers working video streams from IP cameras across 67,288 models and 3,636 brands, then pushes them directly into a Scrypted NVR instance.

The project consists of two components:

1. **Scrix Container** — Docker container running the Go discovery engine + plain JavaScript web UI (forked from Strix)
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
│  │  Plain JS Web UI      │  │     │            │             │
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

The plugin implements `HttpRequestHandler.onRequest()`. Scrypted routes all requests matching `/endpoint/scrypted-scrix/*` to this handler. The plugin receives `request.url` as the path **after** the prefix (e.g., `/api/cameras`). The Go backend proxy must construct the full URL as `https://<scrypted-host>/endpoint/scrypted-scrix/api/cameras`. The plugin manually parses the path — there is no Express-style router.

| Method | Path (as seen by plugin) | Purpose |
|--------|--------------------------|---------|
| `POST` | `/api/cameras` | Create a camera with discovered streams |
| `GET` | `/api/status` | Health check + available detection plugins/types |
| `DELETE` | `/api/cameras?id=<nativeId>` | Remove a Scrix-created camera |

### GET `/api/status` Response

```json
{
  "version": "1.0.0",
  "connected": true,
  "detectionPlugins": ["@scrypted/openvino", "@scrypted/coreml"],
  "availableDetectionTypes": ["person", "vehicle", "animal"],
  "nvrInstalled": true
}
```

The `availableDetectionTypes` field is populated dynamically from installed detection plugins. The Scrix UI uses this to populate the detection type checkboxes rather than hardcoding types.

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

1. Create RTSP camera device via `deviceManager.onDeviceDiscovered()` with interfaces `[VideoCamera, Camera, MotionSensor]`
2. Set `storage["urls"]` with stream URL array (main first, sub second)
3. Set `storage["username"]` and `storage["password"]`

**Mixin auto-attachment:** Scrypted NVR and object detection plugins implement `AutoenableMixinProvider` — they automatically attach to any new Camera device matching their `canMixin()` criteria. Creating the device with `VideoCamera` interface is sufficient for NVR and detection to auto-enable. The `enableNvr` and `enableDetection` options control whether the plugin *removes* these auto-attached mixins after creation (opt-out model rather than opt-in).

**Mechanism for opt-out:** If `enableNvr: false`, the plugin calls `systemManager.getComponent('plugins')` then `plugins.setMixins(deviceId, filteredMixinIds)` to remove the NVR mixin. Same for detection. This runs after a short delay (~2s) to allow auto-attachment to complete.

### Authentication

API key generated on plugin install via `crypto.randomBytes(32).toString('hex')`, stored in `this.storage.setItem('apiKey', key)`, displayed in plugin settings UI. User copies it into Scrix's settings page. Sent as `Authorization: Bearer <key>` header on every request. If the key is regenerated, existing Scrix containers lose connectivity until updated.

## Component 2: Scrix Container (Strix Fork)

### Retained From Strix (Untouched)

- Go backend: discovery engine, camera database, ONVIF, stream testing, ffprobe, SSE
- REST API: `/api/v1/health`, `/api/v1/cameras/search`, `/api/v1/streams/discover`
- Camera brand JSON files (`data/brands/` — 3,636 files)
- Docker multi-stage Alpine build
- Core web UI: discovery panel, stream filtering, real-time progress

**Note:** Strix's web UI uses plain JavaScript ES6 modules (classes like `StrixApp`, `SearchForm`, `StreamList`, `ConfigPanel`), NOT Vue.js. There is no build toolchain — JS files are served as static assets via Go's `//go:embed web` directive. All new UI code must follow this pattern: plain JS classes in `webui/web/js/`, no npm dependencies at runtime.

### Removed From Strix

- `webui/web/js/config-generators/frigate/` — Frigate config generator
- `FRIGATE_RECORD_CONFIG.md` and Frigate-specific docs
- `docker-compose.full.yml` (Frigate full-stack compose)

**Note on go2rtc generator:** The `config-generators/go2rtc/` module is retained for now. The existing `config-panel.js` imports it, and removing it would break the UI without a rewrite. It will be replaced by the new "Add to Scrypted" panel, at which point both the go2rtc generator and the old config panel import can be removed together.

### Added to Scrix

#### Scrypted Settings Page (JS Module)

First-run setup UI:
- Scrypted host URL field (e.g., `https://10.10.10.10:10443`)
- API key field (copied from Scrypted plugin settings)
- "Test Connection" button — calls plugin's `GET /api/status`
- Settings persisted to `/config/scrix.json` (Docker volume)

#### "Add to Scrypted" Panel (JS Module)

Replaces Frigate config generator. Shown after stream discovery:
- Main stream + optional sub stream selector (same UX as Strix)
- Camera name field (auto-generated from IP, editable)
- Checkbox: Enable NVR (default on)
- Checkbox: Enable Detection (default on)
- Detection type multi-select: dynamically populated from `GET /api/status` response (all on by default)
- "Add to Scrypted" button
- Success/error feedback inline

#### Backend Proxy Endpoint

`POST /api/v1/scrypted/add` — Go handler that forwards camera creation request to the Scrypted plugin. Avoids CORS issues (browser → Scrix backend → Scrypted plugin). Also `GET /api/v1/scrypted/status` to proxy the plugin status check.

**TLS handling:** Scrypted typically uses self-signed certificates. The Go HTTP client must skip TLS verification when proxying to Scrypted (configurable via `scrix.json` with `"tlsVerify": false` as default). This is acceptable because the connection is on a trusted LAN between two local services.

#### Config File (`/config/scrix.json`)

```json
{
  "scrypted": {
    "host": "https://10.10.10.10:10443",
    "apiKey": "sk_abc123...",
    "tlsVerify": false
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
   Scrix backend → POST https://<host>/endpoint/scrypted-scrix/api/cameras (plugin)
   Plugin creates RTSP device, sets URLs; NVR/detection auto-attach
   If user opted out of NVR/detection, plugin removes those mixins
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
| Duplicate camera (same IP) | Plugin returns `409 Conflict` with existing camera info. Scrix UI shows warning with "Add Anyway" button that re-sends with `?force=true` query param. |

## Deployment

### Docker Compose

```yaml
services:
  scrix:
    image: scrix/scrix:latest
    container_name: scrix
    volumes:
      - scrix-config:/config
    environment:
      - SCRIX_LOG_LEVEL=info
    restart: unless-stopped
    network_mode: host

volumes:
  scrix-config:
```

`network_mode: host` required for LAN camera probing (RTSP, ONVIF, ffprobe) and Scrypted connectivity. No `ports` directive needed — host networking exposes all container ports directly. Scrix listens on port 4567.

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
- Frontend: manual testing of new JS UI modules

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
