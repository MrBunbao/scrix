# Scrix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Scrix — a camera stream discovery tool that pushes discovered streams directly into Scrypted NVR.

**Architecture:** Two-component system. A Docker container (forked from Strix) runs the Go discovery engine + plain JS web UI. A thin TypeScript Scrypted plugin receives HTTP calls from the container and creates RTSP camera devices in Scrypted.

**Tech Stack:** Go 1.24 (backend), plain JavaScript ES6 modules (frontend), TypeScript (Scrypted plugin), Docker (deployment)

**Spec:** `docs/superpowers/specs/2026-03-17-scrix-design.md`

**Security note:** All frontend code must use safe DOM methods (textContent, createElement, setAttribute) when rendering user-supplied data (camera names, URLs, IPs). Only use static template strings for structural HTML that contains no user input. Never interpolate user data into HTML strings.

---

## File Structure

### Scrypted Plugin (`scrypted-plugin/`)

```
scrypted-plugin/
├── package.json              # npm package config for scrypted-scrix
├── tsconfig.json             # TypeScript config
├── src/
│   └── main.ts              # Plugin entry: HttpRequestHandler, DeviceProvider, Settings
└── test/
    └── main.test.ts          # Unit tests for camera creation logic
```

### Scrix Container (Strix fork — root of repo after fork)

**Files to remove:**
- `webui/web/js/config-generators/frigate/` (entire directory)
- `FRIGATE_RECORD_CONFIG.md`
- `docker-compose.full.yml`

**Files to add:**
- `internal/api/handlers/scrypted.go` — Go proxy handlers for Scrypted plugin
- `internal/scrypted/client.go` — HTTP client for Scrypted plugin communication
- `internal/scrypted/config.go` — Config file read/write for `/config/scrix.json`
- `webui/web/js/ui/scrypted-settings.js` — Settings page UI module
- `webui/web/js/ui/scrypted-panel.js` — "Add to Scrypted" panel UI module
- `docker-compose.yml` — Updated for Scrix deployment

**Files to modify:**
- `go.mod` — Update module path from `github.com/eduard256/Strix` to `github.com/MrBunbao/scrix`
- All `internal/**/*.go` — Update import paths to match new module path
- `internal/api/routes.go` — Add new proxy routes
- `webui/web/js/main.js` — Remove FrigateGenerator import and Frigate-specific methods, integrate Scrypted panel
- `webui/web/js/ui/config-panel.js` — Replace Frigate output with Scrypted panel
- `webui/web/index.html` — Replace Frigate tabs with Scrypted panel, add settings access
- `cmd/strix/main.go` — Rename to Scrix, update banner/references, load Scrypted config
- `Dockerfile` — Update binary name, labels, user, /config directory
- `README.md` — Rewrite for Scrix

---

## Chunk 1: Project Setup & Fork

### Task 1: Fork Strix and set up repository

**Files:**
- All Strix files (cloned)
- Modify: `README.md`, `cmd/strix/main.go`

- [ ] **Step 1: Fork Strix into the Scrix directory**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
git remote add strix https://github.com/eduard256/Strix.git
git fetch strix
git merge strix/main --allow-unrelated-histories
```

This brings all Strix code into our existing repo (which has the spec).

- [ ] **Step 2: Update Go module path**

The Strix `go.mod` declares `module github.com/eduard256/Strix` (capital S). Update to our fork:

```bash
sed -i '' 's|github.com/eduard256/Strix|github.com/MrBunbao/scrix|g' go.mod
```

Then update all Go import paths across the codebase:

```bash
find . -name '*.go' -exec sed -i '' 's|github.com/eduard256/Strix|github.com/MrBunbao/scrix|g' {} +
```

Verify no old paths remain: `grep -r "eduard256/Strix" --include="*.go" .` — should return nothing.

- [ ] **Step 3: Verify the fork builds**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
go build ./cmd/strix/
```

Expected: Binary compiles without errors.

- [ ] **Step 4: Commit the fork**

```bash
git add -A
git commit -m "Import Strix codebase as base for Scrix fork"
```

### Task 2: Strip Frigate-specific code

**Files:**
- Remove: `webui/web/js/config-generators/frigate/` (directory)
- Remove: `FRIGATE_RECORD_CONFIG.md`
- Remove: `docker-compose.full.yml`

- [ ] **Step 1: Delete Frigate config generator**

```bash
rm -rf webui/web/js/config-generators/frigate/
```

- [ ] **Step 2: Delete Frigate docs and full compose**

```bash
rm -f FRIGATE_RECORD_CONFIG.md
rm -f docker-compose.full.yml
```

- [ ] **Step 3: Remove FrigateGenerator from main.js**

Read `webui/web/js/main.js`. The `StrixApp` class imports `FrigateGenerator` from `./config-generators/frigate/index.js` and uses it in `generateFrigateConfig()`. Remove:
- The `FrigateGenerator` import statement
- The `generateFrigateConfig()` method
- The `frigateConfigGenerated` property
- Any Frigate tab handling in `switchTab()`
- The `btn-generate-frigate` event listener

Also check `webui/web/js/ui/config-panel.js` — the Frigate import there is already commented out, but verify and remove the comment.

- [ ] **Step 4: Verify build still works**

```bash
go build ./cmd/strix/
```

Expected: Compiles. The Go backend doesn't import JS files — they're embedded at build time and the embed directive uses the `web` directory recursively, so removing files doesn't break the build.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Strip Frigate config generator, docs, and full compose"
```

### Task 3: Scaffold Scrypted plugin package

**Files:**
- Create: `scrypted-plugin/package.json`
- Create: `scrypted-plugin/tsconfig.json`
- Create: `scrypted-plugin/src/main.ts` (skeleton)

- [ ] **Step 1: Create plugin directory**

```bash
mkdir -p scrypted-plugin/src scrypted-plugin/test
```

- [ ] **Step 2: Create .gitignore for plugin**

Create `scrypted-plugin/.gitignore`:

```
node_modules/
dist/
```

- [ ] **Step 3: Create package.json**

Create `scrypted-plugin/package.json`:

```json
{
  "name": "scrypted-scrix",
  "version": "1.0.0",
  "description": "Scrix — camera stream discovery bridge for Scrypted NVR",
  "main": "dist/main.js",
  "keywords": ["scrypted", "camera", "discovery", "nvr", "rtsp"],
  "author": "MrBunbao",
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "scrypted": {
    "name": "Scrix Camera Discovery",
    "type": "API",
    "interfaces": [
      "HttpRequestHandler",
      "DeviceProvider",
      "Settings"
    ]
  },
  "devDependencies": {
    "@scrypted/sdk": "latest",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

Create `scrypted-plugin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "lib": ["ES2021"],
    "declaration": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Create skeleton main.ts**

Create `scrypted-plugin/src/main.ts`. Note: Use `SettingValue` (not `string`) for `putSetting`, and `ScryptedNativeId` (not `string`) for `getDevice` — these match the Scrypted SDK interface definitions.

```typescript
import sdk, {
    DeviceProvider,
    HttpRequest,
    HttpRequestHandler,
    HttpResponse,
    ScryptedDeviceBase,
    ScryptedDeviceType,
    ScryptedInterface,
    ScryptedNativeId,
    Setting,
    Settings,
    SettingValue,
} from '@scrypted/sdk';

class ScrixPlugin extends ScryptedDeviceBase implements HttpRequestHandler, DeviceProvider, Settings {
    async onRequest(request: HttpRequest, response: HttpResponse): Promise<void> {
        // TODO: implement routing
        response.send(JSON.stringify({ error: 'Not implemented' }), {
            code: 501,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    async getDevice(nativeId: ScryptedNativeId): Promise<any> {
        // TODO: return device by nativeId
        throw new Error('Not implemented');
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
        // cleanup if needed
    }

    async getSettings(): Promise<Setting[]> {
        // TODO: return API key setting
        return [];
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        // TODO: handle setting changes
    }
}

export default ScrixPlugin;
```

- [ ] **Step 6: Install dependencies and verify build**

```bash
cd scrypted-plugin
npm install
npm run build
```

Expected: Compiles to `dist/main.js` without errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
git add scrypted-plugin/
git commit -m "Scaffold scrypted-scrix plugin package"
```

---

## Chunk 2: Scrypted Plugin Implementation

### Task 4: Implement API key authentication

**Files:**
- Modify: `scrypted-plugin/src/main.ts`

- [ ] **Step 1: Add API key generation on first load**

In `ScrixPlugin` constructor, check if an API key exists in storage. If not, generate one:

```typescript
import crypto from 'crypto';

class ScrixPlugin extends ScryptedDeviceBase implements HttpRequestHandler, DeviceProvider, Settings {
    constructor(nativeId?: string) {
        super(nativeId);
        if (!this.storage.getItem('apiKey')) {
            const key = crypto.randomBytes(32).toString('hex');
            this.storage.setItem('apiKey', key);
            this.console.log('Generated new API key. Copy it from plugin settings into Scrix.');
        }
    }
```

- [ ] **Step 2: Implement getSettings to display API key**

```typescript
    async getSettings(): Promise<Setting[]> {
        return [
            {
                key: 'apiKey',
                title: 'API Key',
                description: 'Copy this key into your Scrix container settings page.',
                value: this.storage.getItem('apiKey') || '',
                type: 'string',
                readonly: true,
            },
            {
                key: 'regenerateKey',
                title: 'Regenerate API Key',
                description: 'Generate a new API key. Existing Scrix containers will lose connectivity.',
                type: 'button',
            },
        ];
    }
```

- [ ] **Step 3: Implement putSetting to handle key regeneration**

```typescript
    async putSetting(key: string, value: SettingValue): Promise<void> {
        if (key === 'regenerateKey') {
            const newKey = crypto.randomBytes(32).toString('hex');
            this.storage.setItem('apiKey', newKey);
            this.console.log('API key regenerated.');
        }
    }
```

- [ ] **Step 4: Add auth middleware helper**

```typescript
    private authenticate(request: HttpRequest): boolean {
        const auth = request.headers?.authorization;
        if (!auth) return false;
        const token = auth.replace('Bearer ', '');
        return token === this.storage.getItem('apiKey');
    }
```

- [ ] **Step 5: Verify build**

```bash
cd scrypted-plugin && npm run build
```

Expected: Compiles without errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
git add scrypted-plugin/
git commit -m "Implement API key auth for scrypted-scrix plugin"
```

### Task 5: Implement GET /api/status endpoint

**Files:**
- Modify: `scrypted-plugin/src/main.ts`

- [ ] **Step 1: Add status handler method**

```typescript
    private async handleStatus(response: HttpResponse): Promise<void> {
        const plugins = await sdk.systemManager.getComponent('plugins');
        const devices = sdk.systemManager.getSystemState();

        let nvrInstalled = false;
        const detectionPlugins: string[] = [];
        const detectionTypes = new Set<string>();

        for (const [id, device] of Object.entries(devices)) {
            const interfaces = device.interfaces?.value as string[] | undefined;
            if (!interfaces) continue;

            if (interfaces.includes(ScryptedInterface.ObjectDetection)) {
                const pluginId = device.pluginId?.value as string | undefined;
                if (pluginId && !detectionPlugins.includes(pluginId)) {
                    detectionPlugins.push(pluginId);
                }
            }
        }

        // Check for NVR by looking for the @scrypted/nvr plugin
        try {
            const installedPlugins = await plugins.getInstalledPlugins();
            nvrInstalled = installedPlugins.includes('@scrypted/nvr');
        } catch {
            nvrInstalled = false;
        }

        // Query detection types from installed ObjectDetection devices
        // For v1, use standard types when NVR is installed.
        // Future enhancement: query each ObjectDetection device via getDetectionModel()
        // to discover actual supported types dynamically.
        const standardTypes = ['person', 'vehicle', 'animal'];
        if (nvrInstalled || detectionPlugins.length > 0) {
            standardTypes.forEach(t => detectionTypes.add(t));
        }

        const body = JSON.stringify({
            version: '1.0.0',
            connected: true,
            detectionPlugins,
            availableDetectionTypes: Array.from(detectionTypes),
            nvrInstalled,
        });

        response.send(body, {
            code: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
```

- [ ] **Step 2: Wire status handler into onRequest**

```typescript
    async onRequest(request: HttpRequest, response: HttpResponse): Promise<void> {
        // Auth check
        if (!this.authenticate(request)) {
            response.send(JSON.stringify({ error: 'Unauthorized' }), {
                code: 401,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        const url = request.url || '';
        const method = request.method || 'GET';

        if (method === 'GET' && url.startsWith('/api/status')) {
            return this.handleStatus(response);
        }

        response.send(JSON.stringify({ error: 'Not found' }), {
            code: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }
```

- [ ] **Step 3: Verify build**

```bash
cd scrypted-plugin && npm run build
```

- [ ] **Step 4: Commit**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
git add scrypted-plugin/
git commit -m "Implement GET /api/status endpoint in scrypted-scrix plugin"
```

### Task 6: Implement POST /api/cameras endpoint (camera creation)

**Files:**
- Modify: `scrypted-plugin/src/main.ts`

- [ ] **Step 1: Define the camera request interface**

```typescript
interface CameraRequest {
    name: string;
    ip: string;
    streams: {
        main: string;
        sub?: string;
    };
    username?: string;
    password?: string;
    options?: {
        enableNvr?: boolean;
        enableDetection?: boolean;
        detectionTypes?: string[];
    };
}
```

- [ ] **Step 2: Add camera creation handler**

```typescript
    private async handleCreateCamera(request: HttpRequest, response: HttpResponse): Promise<void> {
        let body: CameraRequest;
        try {
            body = JSON.parse(request.body || '{}');
        } catch {
            response.send(JSON.stringify({ error: 'Invalid JSON' }), {
                code: 400,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        if (!body.name || !body.streams?.main) {
            response.send(JSON.stringify({ error: 'Missing required fields: name, streams.main' }), {
                code: 400,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        // Check for duplicate by IP
        const url = request.url || '';
        const force = url.includes('force=true');
        if (!force && body.ip) {
            const existing = this.findCameraByIp(body.ip);
            if (existing) {
                response.send(JSON.stringify({
                    error: 'Camera with this IP already exists',
                    existingCamera: { id: existing.nativeId, name: existing.name },
                }), {
                    code: 409,
                    headers: { 'Content-Type': 'application/json' },
                });
                return;
            }
        }

        const suffix = body.ip?.replace(/\./g, '_') || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const nativeId = `scrix-${suffix}`;

        // Build URL array: main first, sub second
        const urls: string[] = [body.streams.main];
        if (body.streams.sub) {
            urls.push(body.streams.sub);
        }

        // Register the device with Scrypted
        await sdk.deviceManager.onDeviceDiscovered({
            nativeId,
            name: body.name,
            type: ScryptedDeviceType.Camera,
            interfaces: [
                ScryptedInterface.VideoCamera,
                ScryptedInterface.Camera,
                ScryptedInterface.MotionSensor,
            ],
        });

        // Store stream URLs and credentials
        const device = sdk.deviceManager.getDeviceStorage(nativeId);
        if (device) {
            device.setItem('urls', JSON.stringify(urls));
            if (body.username) device.setItem('username', body.username);
            if (body.password) device.setItem('password', body.password);
            device.setItem('ip', body.ip || '');
        }

        // Track this camera in our managed list
        this.addManagedCamera(nativeId, body.name, body.ip);

        // Handle mixin opt-out after delay (allow auto-attach to complete)
        const options = body.options || {};
        if (options.enableNvr === false || options.enableDetection === false) {
            setTimeout(async () => {
                try {
                    await this.handleMixinOptOut(nativeId, options);
                } catch (e) {
                    this.console.error(`Mixin opt-out failed for ${nativeId}: ${e}`);
                }
            }, 2000);
        }

        response.send(JSON.stringify({
            id: nativeId,
            name: body.name,
            status: 'created',
        }), {
            code: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    }
```

- [ ] **Step 3: Add helper methods for managed cameras and duplicate detection**

```typescript
    private getManagedCameras(): Array<{ nativeId: string; name: string; ip: string }> {
        const raw = this.storage.getItem('managedCameras');
        return raw ? JSON.parse(raw) : [];
    }

    private addManagedCamera(nativeId: string, name: string, ip: string): void {
        const cameras = this.getManagedCameras();
        cameras.push({ nativeId, name, ip });
        this.storage.setItem('managedCameras', JSON.stringify(cameras));
    }

    private removeManagedCamera(nativeId: string): void {
        const cameras = this.getManagedCameras().filter(c => c.nativeId !== nativeId);
        this.storage.setItem('managedCameras', JSON.stringify(cameras));
    }

    private findCameraByIp(ip: string): { nativeId: string; name: string } | undefined {
        return this.getManagedCameras().find(c => c.ip === ip);
    }
```

- [ ] **Step 4: Add mixin opt-out handler**

```typescript
    private async handleMixinOptOut(
        nativeId: string,
        options: { enableNvr?: boolean; enableDetection?: boolean }
    ): Promise<void> {
        const plugins = await sdk.systemManager.getComponent('plugins');
        const deviceId = sdk.deviceManager.getDeviceState(nativeId)?.id;
        if (!deviceId) return;

        // Get current mixins via the plugins component
        let mixins: string[];
        try {
            mixins = await plugins.getMixins(deviceId);
        } catch {
            // getMixins may not exist on all versions; try getDeviceInfo fallback
            const info = await plugins.getDeviceInfo(deviceId);
            mixins = info?.mixins ? [...info.mixins] : [];
        }
        if (!mixins.length) return;

        // Known plugin IDs for NVR and detection
        const nvrPluginId = '@scrypted/nvr';
        const detectionPluginIds = [
            '@scrypted/openvino', '@scrypted/coreml',
            '@scrypted/onnx', '@scrypted/tensorflow-lite',
            '@scrypted/opencv', '@scrypted/objectdetector',
        ];

        if (options.enableNvr === false) {
            mixins = mixins.filter((m: string) => m !== nvrPluginId);
        }
        if (options.enableDetection === false) {
            mixins = mixins.filter((m: string) => !detectionPluginIds.includes(m));
        }

        await plugins.setMixins(deviceId, mixins);
    }
```

- [ ] **Step 5: Wire create handler into onRequest**

Add to the `onRequest` method, after the status check:

```typescript
        if (method === 'POST' && url.startsWith('/api/cameras')) {
            return this.handleCreateCamera(request, response);
        }
```

- [ ] **Step 6: Verify build**

```bash
cd scrypted-plugin && npm run build
```

- [ ] **Step 7: Commit**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
git add scrypted-plugin/
git commit -m "Implement POST /api/cameras endpoint for camera creation"
```

### Task 7: Implement DELETE /api/cameras endpoint

**Files:**
- Modify: `scrypted-plugin/src/main.ts`

- [ ] **Step 1: Add delete handler**

```typescript
    private async handleDeleteCamera(request: HttpRequest, response: HttpResponse): Promise<void> {
        const url = request.url || '';
        const params = new URLSearchParams(url.split('?')[1] || '');
        const nativeId = params.get('id');

        if (!nativeId) {
            response.send(JSON.stringify({ error: 'Missing id parameter' }), {
                code: 400,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        const managed = this.getManagedCameras();
        const camera = managed.find(c => c.nativeId === nativeId);
        if (!camera) {
            response.send(JSON.stringify({ error: 'Camera not found or not managed by Scrix' }), {
                code: 404,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        // Remove from Scrypted
        await sdk.deviceManager.onDeviceRemoved(nativeId);
        this.removeManagedCamera(nativeId);

        response.send(JSON.stringify({ id: nativeId, status: 'deleted' }), {
            code: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
```

- [ ] **Step 2: Wire delete handler into onRequest**

Add to `onRequest`, after the POST check:

```typescript
        if (method === 'DELETE' && url.startsWith('/api/cameras')) {
            return this.handleDeleteCamera(request, response);
        }
```

- [ ] **Step 3: Implement getDevice for DeviceProvider**

```typescript
    async getDevice(nativeId: ScryptedNativeId): Promise<any> {
        return new ScryptedDeviceBase(nativeId);
    }
```

- [ ] **Step 4: Verify build**

```bash
cd scrypted-plugin && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
git add scrypted-plugin/
git commit -m "Implement DELETE /api/cameras endpoint and DeviceProvider"
```

---

## Chunk 3: Go Backend — Scrypted Proxy & Config

### Task 8: Add Scrypted config management

**Files:**
- Create: `internal/scrypted/config.go`

- [ ] **Step 1: Create the scrypted package directory**

```bash
mkdir -p internal/scrypted
```

- [ ] **Step 2: Write config.go**

Create `internal/scrypted/config.go`:

```go
package scrypted

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Config struct {
	Scrypted ScryptedConfig `json:"scrypted"`
}

type ScryptedConfig struct {
	Host      string `json:"host"`
	APIKey    string `json:"apiKey"`
	TLSVerify bool   `json:"tlsVerify"`
}

var (
	configPath string
	configMu   sync.RWMutex
)

func SetConfigPath(path string) {
	configMu.Lock()
	defer configMu.Unlock()
	configPath = path
}

func getConfigFilePath() string {
	configMu.RLock()
	defer configMu.RUnlock()
	if configPath == "" {
		return "/config/scrix.json"
	}
	return filepath.Join(configPath, "scrix.json")
}

func LoadConfig() (*Config, error) {
	path := getConfigFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Config{}, nil
		}
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func SaveConfig(cfg *Config) error {
	path := getConfigFilePath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
```

- [ ] **Step 3: Verify build**

```bash
go build ./internal/scrypted/
```

- [ ] **Step 4: Commit**

```bash
git add internal/scrypted/
git commit -m "Add Scrypted config management (read/write scrix.json)"
```

### Task 9: Add Scrypted HTTP client

**Files:**
- Create: `internal/scrypted/client.go`

- [ ] **Step 1: Write client.go**

Create `internal/scrypted/client.go`:

```go
package scrypted

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewClient(cfg *ScryptedConfig) *Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: !cfg.TLSVerify,
		},
	}
	return &Client{
		baseURL: cfg.Host,
		apiKey:  cfg.APIKey,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   30 * time.Second,
		},
	}
}

func (c *Client) pluginURL(path string) string {
	return fmt.Sprintf("%s/endpoint/scrypted-scrix%s", c.baseURL, path)
}

func (c *Client) do(method, path string, body []byte) (int, []byte, error) {
	url := c.pluginURL(path)
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return 0, nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, fmt.Errorf("reading response: %w", err)
	}

	return resp.StatusCode, respBody, nil
}

func (c *Client) GetStatus() (int, []byte, error) {
	return c.do("GET", "/api/status", nil)
}

func (c *Client) AddCamera(payload []byte) (int, []byte, error) {
	return c.do("POST", "/api/cameras", payload)
}

func (c *Client) AddCameraForce(payload []byte) (int, []byte, error) {
	return c.do("POST", "/api/cameras?force=true", payload)
}

func (c *Client) DeleteCamera(nativeId string) (int, []byte, error) {
	return c.do("DELETE", "/api/cameras?id="+url.QueryEscape(nativeId), nil)
}
```

- [ ] **Step 2: Verify build**

```bash
go build ./internal/scrypted/
```

- [ ] **Step 3: Commit**

```bash
git add internal/scrypted/
git commit -m "Add Scrypted HTTP client for plugin communication"
```

### Task 10: Add Scrypted proxy handlers

**Files:**
- Create: `internal/api/handlers/scrypted.go`
- Modify: `internal/api/routes.go`

- [ ] **Step 1: Write scrypted.go handler**

Create `internal/api/handlers/scrypted.go`. The module path was updated in Task 1 to `github.com/MrBunbao/scrix`.

```go
package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/MrBunbao/scrix/internal/scrypted"
)

type ScryptedHandler struct{}

func NewScryptedHandler() *ScryptedHandler {
	return &ScryptedHandler{}
}

func (h *ScryptedHandler) getClient() (*scrypted.Client, error) {
	cfg, err := scrypted.LoadConfig()
	if err != nil {
		return nil, err
	}
	if cfg.Scrypted.Host == "" || cfg.Scrypted.APIKey == "" {
		return nil, fmt.Errorf("scrypted not configured")
	}
	return scrypted.NewClient(&cfg.Scrypted), nil
}

// GET /api/v1/scrypted/status
func (h *ScryptedHandler) Status(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Scrypted not configured. Check settings.",
		})
		return
	}

	status, body, err := client.GetStatus()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "Cannot connect to Scrypted: " + err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}

// POST /api/v1/scrypted/add
func (h *ScryptedHandler) AddCamera(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Scrypted not configured. Check settings.",
		})
		return
	}

	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Failed to read request body",
		})
		return
	}

	force := r.URL.Query().Get("force") == "true"
	var status int
	var respBody []byte
	if force {
		status, respBody, err = client.AddCameraForce(body)
	} else {
		status, respBody, err = client.AddCamera(body)
	}

	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "Cannot connect to Scrypted: " + err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(respBody)
}

// GET /api/v1/scrypted/settings
func (h *ScryptedHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	cfg, err := scrypted.LoadConfig()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to load config: " + err.Error(),
		})
		return
	}

	// Don't send the full API key to the frontend — just whether it's set
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"host":      cfg.Scrypted.Host,
		"hasApiKey": cfg.Scrypted.APIKey != "",
		"tlsVerify": cfg.Scrypted.TLSVerify,
	})
}

// POST /api/v1/scrypted/settings
func (h *ScryptedHandler) SaveSettings(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Host      string `json:"host"`
		APIKey    string `json:"apiKey"`
		TLSVerify bool   `json:"tlsVerify"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Invalid JSON",
		})
		return
	}

	cfg := &scrypted.Config{
		Scrypted: scrypted.ScryptedConfig{
			Host:      input.Host,
			APIKey:    input.APIKey,
			TLSVerify: input.TLSVerify,
		},
	}
	if err := scrypted.SaveConfig(cfg); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to save config: " + err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// DELETE /api/v1/scrypted/cameras?id=<nativeId>
func (h *ScryptedHandler) DeleteCamera(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Scrypted not configured. Check settings.",
		})
		return
	}

	nativeId := r.URL.Query().Get("id")
	if nativeId == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Missing id parameter",
		})
		return
	}

	status, respBody, err := client.DeleteCamera(nativeId)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "Cannot connect to Scrypted: " + err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(respBody)
}

// writeJSON is a helper specific to scrypted handlers.
// Check if other handler files define a similar helper — if so, rename this
// to scryptedWriteJSON or extract to a shared utility.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
```

- [ ] **Step 2: Add routes to routes.go**

Read `internal/api/routes.go` to find the existing routing pattern. Strix uses chi router with routes defined in `setupRoutes()`. The router is mounted at `/api/v1` in `main.go` via `unifiedRouter.Mount("/api/v1", apiServer.GetRouter())`, so routes here are **relative to /api/v1** — do NOT include the `/api/v1` prefix.

Also note: existing handlers use `NewXxxHandler(...).ServeHTTP` pattern. The ScryptedHandler has multiple methods, so we register them individually — document this deviation with a comment.

```go
// In setupRoutes(), add:
// ScryptedHandler uses individual method handlers (not ServeHTTP pattern)
// because it serves multiple routes from one struct.
scryptedHandler := handlers.NewScryptedHandler()
r.Get("/scrypted/status", scryptedHandler.Status)
r.Post("/scrypted/add", scryptedHandler.AddCamera)
r.Delete("/scrypted/cameras", scryptedHandler.DeleteCamera)
r.Get("/scrypted/settings", scryptedHandler.GetSettings)
r.Post("/scrypted/settings", scryptedHandler.SaveSettings)
```

The full URLs will be `/api/v1/scrypted/status`, `/api/v1/scrypted/add`, etc.

- [ ] **Step 3: Verify build**

```bash
go build ./cmd/strix/
```

- [ ] **Step 4: Commit**

```bash
git add internal/api/handlers/scrypted.go internal/api/routes.go
git commit -m "Add Scrypted proxy handlers and config API routes"
```

---

## Chunk 4: Frontend — Settings & Add to Scrypted

### Task 11: Create Scrypted settings page

**Files:**
- Create: `webui/web/js/ui/scrypted-settings.js`

- [ ] **Step 1: Read existing UI modules for patterns**

Read `webui/web/js/ui/config-panel.js` and at least one other UI module to understand the class pattern, DOM manipulation style, and how modules are imported/exported. Follow the same conventions exactly.

- [ ] **Step 2: Write scrypted-settings.js**

Create `webui/web/js/ui/scrypted-settings.js` following the existing class pattern. Use safe DOM methods — build all elements with `document.createElement()` and `textContent` for any user-supplied values. Only use static structural HTML via template literals where no user data is interpolated.

The module exports a `ScryptedSettings` class with:
- `constructor(container)` — receives a DOM element, calls `render()` and `loadSettings()`
- `render()` — builds the settings form: host URL input, API key input, Test Connection button, Save button, status message area
- `loadSettings()` — fetches `GET /api/v1/scrypted/settings` and populates fields
- `saveSettings()` — posts to `POST /api/v1/scrypted/settings`
- `testConnection()` — calls `GET /api/v1/scrypted/status` and displays result
- `showStatus(message, type)` — shows success/error/info message using textContent

- [ ] **Step 3: Verify file is syntactically valid**

```bash
node --check webui/web/js/ui/scrypted-settings.js
```

Expected: No output (valid syntax).

- [ ] **Step 4: Commit**

```bash
git add webui/web/js/ui/scrypted-settings.js
git commit -m "Add Scrypted settings page UI module"
```

### Task 12: Create "Add to Scrypted" panel

**Files:**
- Create: `webui/web/js/ui/scrypted-panel.js`

- [ ] **Step 1: Write scrypted-panel.js**

Create `webui/web/js/ui/scrypted-panel.js` following the existing class pattern. Use safe DOM construction — `createElement`, `textContent`, `setAttribute` for all user-supplied data (camera names, URLs, IPs, resolution strings). Never interpolate user data into HTML template strings.

The module exports a `ScryptedPanel` class with:
- `constructor(container)` — receives DOM element, calls `loadStatus()`
- `loadStatus()` — fetches `GET /api/v1/scrypted/status` to get available detection types and NVR status
- `setStreams(mainStream, subStream)` — called by config-panel when user selects streams; triggers `render()`
- `render()` — builds the "Add to Scrypted" form:
  - Stream summary (main + sub URLs, resolution, codec) — use textContent for values
  - Camera name input (auto-generated from IP, editable)
  - Enable NVR checkbox (default on, only shown if `nvrInstalled`)
  - Enable Detection checkbox (default on, only shown if detection types available)
  - Detection type checkboxes (dynamically from `availableDetectionTypes`)
  - "Add to Scrypted" button
  - Status message area
- `addCamera(force)` — builds JSON payload, posts to `POST /api/v1/scrypted/add`, handles 201/409/error
- `showDuplicateWarning(data)` — shows 409 conflict with "Add Anyway" button
- `extractIp(url)` — extracts IP from RTSP URL
- `showStatus(message, type)` — shows feedback using textContent

- [ ] **Step 2: Verify syntax**

```bash
node --check webui/web/js/ui/scrypted-panel.js
```

- [ ] **Step 3: Commit**

```bash
git add webui/web/js/ui/scrypted-panel.js
git commit -m "Add 'Add to Scrypted' panel UI module"
```

### Task 13: Integrate new panels into existing UI

**Files:**
- Modify: `webui/web/js/main.js` (primary integration point)
- Modify: `webui/web/js/ui/config-panel.js`
- Modify: `webui/web/index.html`

**Context:** Strix's UI is a 4-screen sequential flow managed by `StrixApp` in `main.js`:
- Screen 1: Address input
- Screen 2: Camera model config
- Screen 3: Discovery progress
- Screen 4: Output (tabs: "Frigate" / "Go2RTC" / "URL")

The `StrixApp` class in `main.js` imports `FrigateGenerator` and `ConfigPanel`. When a stream is selected, it calls `configPanel.render()` and has a `generateFrigateConfig()` method. Screen 4 in `index.html` has hardcoded Frigate/Go2RTC/URL tabs.

- [ ] **Step 1: Read main.js fully**

Read `webui/web/js/main.js`. Map all Frigate-related code:
- `FrigateGenerator` import
- `generateFrigateConfig()` method
- `frigateConfigGenerated` property
- Frigate tab in `switchTab()` or screen navigation
- `btn-generate-frigate` event listener
- How `ConfigPanel` is used (constructor args, `render()` calls)

- [ ] **Step 2: Read index.html Screen 4**

Read `webui/web/index.html`. Find the output screen (Screen 4) which has Frigate/Go2RTC/URL tabs. Identify:
- Tab button elements and their IDs
- Content panes for each tab
- Where the config output is rendered

- [ ] **Step 3: Modify main.js**

1. Remove `FrigateGenerator` import
2. Add: `import { ScryptedPanel } from './ui/scrypted-panel.js';`
3. Add: `import { ScryptedSettings } from './ui/scrypted-settings.js';`
4. In the constructor or init, create `this.scryptedPanel = new ScryptedPanel(document.getElementById('scrypted-panel-container'))` (the container will be added in index.html)
5. Replace `generateFrigateConfig()` with a method that calls `this.scryptedPanel.setStreams(mainStream, subStream)` when streams are selected
6. Remove Frigate tab switching logic
7. Add settings initialization: when a settings button is clicked, show settings container and init `new ScryptedSettings(settingsContainer)`

Follow the existing `StrixApp` class patterns for event binding and screen navigation.

- [ ] **Step 4: Modify config-panel.js**

Remove the commented-out Frigate import. Replace the config output rendering to delegate to the ScryptedPanel rather than generating YAML. The `ConfigPanel` class may need significant changes or can be simplified since its role changes from "generate config text" to "display Scrypted add-camera form."

- [ ] **Step 5: Modify index.html Screen 4**

Replace the Frigate/Go2RTC/URL tab structure with:
- A single `<div id="scrypted-panel-container"></div>` for the Add to Scrypted panel
- Keep the URL tab if it shows the raw stream URL (useful for debugging)
- Add a settings icon/button in the app header area (or on Screen 1) that reveals a `<div id="scrypted-settings-container">` — since the UI has no persistent nav bar, a gear icon in the top-right corner is the simplest approach

- [ ] **Step 6: Add CSS for new components**

Read the existing CSS file(s) to find the styling patterns. Add styles for:
- `.scrypted-settings` — settings form layout
- `.scrypted-panel` — add to Scrypted panel
- `.status-message` variants (`.status-success`, `.status-error`, `.status-info`, `.status-warning`)
- `.checkbox-group`, `.checkbox-inline` — detection type checkboxes

- [ ] **Step 5: Verify Go build (embed includes new files)**

```bash
go build ./cmd/strix/
```

The `//go:embed web` directive recursively includes all files under `webui/web/`, so new JS files are automatically included.

- [ ] **Step 6: Test manually by running the binary**

```bash
./strix
# Open http://localhost:4567 in browser
# Verify settings page loads, discovery still works
```

- [ ] **Step 7: Commit**

```bash
git add webui/web/js/ui/config-panel.js webui/web/index.html
git commit -m "Integrate Scrypted settings and Add to Scrypted panel into UI"
```

---

## Chunk 5: Docker, Branding & Integration Testing

### Task 14: Update Docker and branding

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `cmd/strix/main.go`
- Modify: `README.md`

- [ ] **Step 1: Read Dockerfile**

Read `Dockerfile` to understand the current multi-stage build structure. The Strix Dockerfile:
- Uses a multi-stage build (builder + runtime)
- Creates a non-root user `strix` (UID 1000)
- Builds binary as `strix`
- Has `CMD ["./strix"]`
- Creates `/app/config` directory

- [ ] **Step 2: Update Dockerfile comprehensively**

Apply all these changes:
1. Rename binary: change `go build -o strix` to `go build -o scrix` in the builder stage
2. Rename user: change `adduser strix` to `adduser scrix` and update all `chown`/`USER` directives
3. Update CMD: `CMD ["./scrix"]`
4. Add `/config` directory with correct ownership:
   ```dockerfile
   RUN mkdir -p /config && chown scrix:scrix /config
   ```
   This must come before the `USER scrix` directive.
5. Add volume: `VOLUME /config`
6. Update labels:
   ```dockerfile
   LABEL maintainer="MrBunbao"
   LABEL description="Scrix — camera stream discovery for Scrypted NVR"
   ```
7. Verify health check endpoint still works (likely `/api/v1/health`)

- [ ] **Step 3: Create docker-compose.yml for Scrix**

Overwrite `docker-compose.yml`:

```yaml
services:
  scrix:
    image: scrix/scrix:latest
    container_name: scrix
    build: .
    volumes:
      - scrix-config:/config
    environment:
      - SCRIX_LOG_LEVEL=info
    restart: unless-stopped
    network_mode: host

volumes:
  scrix-config:
```

- [ ] **Step 4: Update main.go references**

Read `cmd/strix/main.go`. Update:
- ASCII banner constant: change "STRIX" to "SCRIX"
- Log messages from "Strix" to "Scrix"
- Application name/version strings
- Documentation URL references (change `github.com/eduard256/Strix` to `github.com/MrBunbao/scrix`)
- Add Scrypted config path initialization:
  ```go
  import "github.com/MrBunbao/scrix/internal/scrypted"

  configPath := os.Getenv("SCRIX_CONFIG_PATH")
  if configPath == "" {
      configPath = "/config"
  }
  scrypted.SetConfigPath(configPath)
  ```

- [ ] **Step 5: Write minimal README.md**

Overwrite `README.md` with Scrix-specific content:
- What Scrix is (one paragraph)
- Quick start: Docker compose + plugin install + setup
- Link to the design spec for details

- [ ] **Step 6: Build Docker image locally**

```bash
docker build -t scrix/scrix:dev .
```

Expected: Image builds successfully.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml cmd/strix/main.go README.md
git commit -m "Rebrand to Scrix: update Docker, compose, main.go, README"
```

### Task 15: Integration test — plugin on real Scrypted

**Files:** No new files — this is a manual test sequence.

- [ ] **Step 1: Build and deploy the Scrypted plugin**

```bash
cd scrypted-plugin
npm install
npm run build
# Deploy to Scrypted on NAS (10.10.10.10)
npx scrypted login https://10.10.10.10:10443
npx scrypted push
```

- [ ] **Step 2: Verify plugin appears in Scrypted**

Open Scrypted management console at `https://10.10.10.10:10443`. Verify:
- "Scrix Camera Discovery" appears in the plugins list
- Plugin settings show the generated API key
- Copy the API key

- [ ] **Step 3: Run Scrix container**

```bash
cd /Users/admad/Nextcloud/Projects/Scrix
docker compose up -d
```

- [ ] **Step 4: Configure Scrix settings**

Open `http://10.10.10.10:4567` (or host IP). Go to settings:
- Enter Scrypted host: `https://10.10.10.10:10443`
- Paste the API key
- Click "Test Connection"

Expected: "Connected to Scrypted. NVR installed."

- [ ] **Step 5: Discover streams on a test camera**

Enter a camera IP (try the Reolink E1 at `10.10.10.158` or any other camera on the LAN). Click "Discover Streams." Wait for results.

- [ ] **Step 6: Add camera to Scrypted**

Select main stream (and sub if available). Name the camera. Leave NVR and detection enabled. Click "Add to Scrypted."

Expected: Success message. Camera appears in Scrypted NVR.

- [ ] **Step 7: Verify in Scrypted**

Open Scrypted management console. Verify:
- New camera device exists with correct name
- Stream URLs are set correctly
- NVR recording is active (if NVR mixin attached)
- Object detection is active (if detection mixin attached)

- [ ] **Step 8: Test duplicate detection**

Try adding the same camera IP again.

Expected: 409 Conflict with "Add Anyway" option.

- [ ] **Step 9: Test camera deletion**

If the plugin exposes the delete endpoint, test removing the camera.

- [ ] **Step 10: Document any issues found**

If anything does not work, document the issue and fix it before final commit.

- [ ] **Step 11: Final commit**

```bash
git add -A
git commit -m "Integration testing fixes"
```

### Task 16: Publish artifacts

**Files:** No code changes — deployment steps.

- [ ] **Step 1: Create GitHub repo**

```bash
gh repo create MrBunbao/scrix --public --source=. --push
```

- [ ] **Step 2: Build and push Docker image**

```bash
docker login  # Authenticate to Docker Hub first
docker build -t scrix/scrix:latest -t scrix/scrix:1.0.0 .
docker push scrix/scrix:latest
docker push scrix/scrix:1.0.0
```

- [ ] **Step 3: Publish npm package**

```bash
cd scrypted-plugin
npm login  # Authenticate to npm first
npm publish
```

- [ ] **Step 4: Verify end-to-end with published artifacts**

On a clean setup: `docker pull scrix/scrix:latest`, install `scrypted-scrix` from Scrypted plugin UI, verify the full workflow.
