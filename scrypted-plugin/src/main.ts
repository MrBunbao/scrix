import sdk, {
    DeviceProvider,
    FFmpegInput,
    HttpRequest,
    HttpRequestHandler,
    HttpResponse,
    MediaObject,
    ScryptedDeviceBase,
    ScryptedDeviceType,
    ScryptedInterface,
    ScryptedMimeTypes,
    ScryptedNativeId,
    Setting,
    Settings,
    SettingValue,
    VideoCamera,
} from '@scrypted/sdk';

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

interface ManagedCamera {
    nativeId: string;
    scryptedId: string;
    name: string;
    ip: string;
    createdAt: string;
}

function generateHex(bytes: number): string {
    try {
        return require('crypto').randomBytes(bytes).toString('hex');
    } catch {
        // Fallback if crypto module unavailable in Scrypted runtime
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < bytes * 2; i++) {
            result += chars[Math.floor(Math.random() * 16)];
        }
        return result;
    }
}

const nvrPluginId = '@scrypted/nvr';
const detectionPluginIds = [
    '@scrypted/openvino',
    '@scrypted/coreml',
    '@scrypted/onnx',
    '@scrypted/tensorflow-lite',
    '@scrypted/opencv',
    '@scrypted/objectdetector',
];

class ScrixPlugin extends ScryptedDeviceBase implements HttpRequestHandler, DeviceProvider, Settings {
    constructor(nativeId?: string) {
        super(nativeId);
        if (!this.storage.getItem('apiKey')) {
            const key = generateHex(32);
            this.storage.setItem('apiKey', key);
            this.console.log('Generated new API key. Copy it from plugin settings into Scrix.');
        }
    }

    // --- Settings ---

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

    async putSetting(key: string, value: SettingValue): Promise<void> {
        if (key === 'regenerateKey') {
            const newKey = generateHex(32);
            this.storage.setItem('apiKey', newKey);
            this.console.log('API key regenerated.');
        }
    }

    // --- Auth middleware ---

    private authenticate(request: HttpRequest): boolean {
        const headers = request.headers || {};
        const auth = headers.authorization || (headers as any).Authorization;
        if (!auth) return false;
        const token = auth.replace('Bearer ', '');
        return token === this.storage.getItem('apiKey');
    }

    // --- Status endpoint ---

    private async handleStatus(response: HttpResponse): Promise<void> {
        const plugins = await sdk.systemManager.getComponent('plugins');
        const devices = sdk.systemManager.getSystemState();

        let nvrInstalled = false;
        const detectionPlugins: string[] = [];
        const detectionTypes = new Set<string>();

        for (const [id, device] of Object.entries(devices)) {
            const interfaces = (device as any).interfaces?.value as string[] | undefined;
            if (!interfaces) continue;
            if (interfaces.includes(ScryptedInterface.ObjectDetection)) {
                const pluginId = (device as any).pluginId?.value as string | undefined;
                if (pluginId && !detectionPlugins.includes(pluginId)) {
                    detectionPlugins.push(pluginId);
                }
            }
        }

        try {
            const installedPlugins = await plugins.getInstalledPlugins();
            nvrInstalled = installedPlugins.includes('@scrypted/nvr');
        } catch {
            nvrInstalled = false;
        }

        // v1: standard types when NVR or detection plugins present
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

    // --- Managed cameras helpers ---

    private getManagedCameras(): ManagedCamera[] {
        const raw = this.storage.getItem('managedCameras');
        if (!raw) return [];
        try {
            return JSON.parse(raw) as ManagedCamera[];
        } catch {
            return [];
        }
    }

    private saveManagedCameras(cameras: ManagedCamera[]): void {
        this.storage.setItem('managedCameras', JSON.stringify(cameras));
    }

    private addManagedCamera(camera: ManagedCamera): void {
        const cameras = this.getManagedCameras();
        cameras.push(camera);
        this.saveManagedCameras(cameras);
    }

    private removeManagedCamera(nativeId: string): void {
        const cameras = this.getManagedCameras().filter(c => c.nativeId !== nativeId);
        this.saveManagedCameras(cameras);
    }

    private findCameraByIp(ip: string): ManagedCamera | undefined {
        return this.getManagedCameras().find(c => c.ip === ip);
    }

    // --- Camera creation endpoint ---

    private async handleCreateCamera(request: HttpRequest, response: HttpResponse): Promise<void> {
        let body: CameraRequest;
        try {
            body = JSON.parse(request.body || '{}');
        } catch {
            response.send(JSON.stringify({ error: 'Invalid JSON body' }), {
                code: 400,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        // Validate required fields
        if (!body.name || !body.ip || !body.streams?.main) {
            response.send(JSON.stringify({
                error: 'Missing required fields: name, ip, streams.main',
            }), {
                code: 400,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        // Check for duplicate IP
        const url = request.url || '';
        const params = new URLSearchParams(url.split('?')[1] || '');
        const force = params.get('force') === 'true';

        const existing = this.findCameraByIp(body.ip);
        if (existing && !force) {
            response.send(JSON.stringify({
                error: `Camera already exists at IP ${body.ip}`,
                existingId: existing.scryptedId,
                existingNativeId: existing.nativeId,
                hint: 'Use ?force=true to replace the existing camera.',
            }), {
                code: 409,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        // If force-replacing, remove the old device first
        if (existing && force) {
            try {
                await sdk.deviceManager.onDeviceRemoved(existing.nativeId);
                this.removeManagedCamera(existing.nativeId);
                this.console.log(`Removed existing camera at IP ${body.ip} (force replace).`);
            } catch (e) {
                this.console.error(`Failed to remove existing camera: ${e}`);
            }
        }

        // Generate nativeId: scrix-{ip_with_underscores} with crypto fallback
        let nativeId = `scrix-${body.ip.replace(/\./g, '_')}`;
        // Check if this nativeId is already in use by another camera
        const allNativeIds = sdk.deviceManager.getNativeIds();
        if (allNativeIds.includes(nativeId)) {
            nativeId = `scrix-${body.ip.replace(/\./g, '_')}-${generateHex(4)}`;
        }

        // Create the RTSP camera device in Scrypted
        const scryptedId = await sdk.deviceManager.onDeviceDiscovered({
            name: body.name,
            nativeId,
            type: ScryptedDeviceType.Camera,
            interfaces: [
                ScryptedInterface.VideoCamera,
                ScryptedInterface.Settings,
            ],
            info: {
                manufacturer: 'Scrix',
                ip: body.ip,
            },
        });

        // Store RTSP stream URLs in the device's storage
        const deviceStorage = sdk.deviceManager.getDeviceStorage(nativeId);
        if (deviceStorage) {
            deviceStorage.setItem('ip', body.ip);
            deviceStorage.setItem('mainStreamUrl', body.streams.main);
            if (body.streams.sub) {
                deviceStorage.setItem('subStreamUrl', body.streams.sub);
            }
            if (body.username) {
                deviceStorage.setItem('username', body.username);
            }
            if (body.password) {
                deviceStorage.setItem('password', body.password);
            }
        }

        // Track the managed camera
        const managedCamera: ManagedCamera = {
            nativeId,
            scryptedId,
            name: body.name,
            ip: body.ip,
            createdAt: new Date().toISOString(),
        };
        this.addManagedCamera(managedCamera);

        this.console.log(`Created camera "${body.name}" at ${body.ip} (nativeId: ${nativeId}, scryptedId: ${scryptedId}).`);

        // Handle mixin opt-out after a short delay to let device initialize
        const enableNvr = body.options?.enableNvr ?? true;
        const enableDetection = body.options?.enableDetection ?? true;

        if (!enableNvr || !enableDetection) {
            setTimeout(async () => {
                try {
                    const device = sdk.systemManager.getDeviceById(scryptedId);
                    if (!device) return;

                    // Get current mixins
                    const state = sdk.systemManager.getSystemState();
                    const deviceState = state[scryptedId];
                    const currentMixins = (deviceState as any)?.mixins?.value as string[] | undefined;
                    if (!currentMixins || currentMixins.length === 0) return;

                    // Build list of plugin IDs to exclude
                    const excludeIds: string[] = [];
                    if (!enableNvr) excludeIds.push(nvrPluginId);
                    if (!enableDetection) excludeIds.push(...detectionPluginIds);

                    // Filter out mixin devices that belong to excluded plugins
                    const filteredMixins = currentMixins.filter(mixinId => {
                        const mixinDevice = sdk.systemManager.getDeviceById(mixinId);
                        if (!mixinDevice) return true;
                        const mixinState = state[mixinId];
                        const pluginId = (mixinState as any)?.pluginId?.value as string | undefined;
                        return !pluginId || !excludeIds.includes(pluginId);
                    });

                    if (filteredMixins.length !== currentMixins.length) {
                        await device.setMixins(filteredMixins);
                        this.console.log(`Mixin opt-out applied for camera "${body.name}".`);
                    }
                } catch (e) {
                    this.console.error(`Failed to apply mixin opt-out: ${e}`);
                }
            }, 2000);
        }

        response.send(JSON.stringify({
            id: scryptedId,
            nativeId,
            name: body.name,
            ip: body.ip,
            created: true,
        }), {
            code: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // --- Camera deletion endpoint ---

    private async handleDeleteCamera(request: HttpRequest, response: HttpResponse): Promise<void> {
        const rawUrl = request.url || '';
        const params = new URLSearchParams(rawUrl.split('?')[1] || '');
        const id = params.get('id');

        if (!id) {
            response.send(JSON.stringify({ error: 'Missing required query parameter: id' }), {
                code: 400,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        // Find in managed cameras by scryptedId or nativeId
        const cameras = this.getManagedCameras();
        const camera = cameras.find(c => c.scryptedId === id || c.nativeId === id);

        if (!camera) {
            response.send(JSON.stringify({ error: `Camera not found: ${id}` }), {
                code: 404,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        try {
            await sdk.deviceManager.onDeviceRemoved(camera.nativeId);
            this.removeManagedCamera(camera.nativeId);
            this.console.log(`Deleted camera "${camera.name}" (nativeId: ${camera.nativeId}).`);

            response.send(JSON.stringify({
                deleted: true,
                id: camera.scryptedId,
                nativeId: camera.nativeId,
                name: camera.name,
            }), {
                code: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (e) {
            response.send(JSON.stringify({
                error: `Failed to delete camera: ${e}`,
            }), {
                code: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    // --- HTTP handler ---

    async onRequest(request: HttpRequest, response: HttpResponse): Promise<void> {
        if (!this.authenticate(request)) {
            response.send(JSON.stringify({ error: 'Unauthorized' }), {
                code: 401,
                headers: { 'Content-Type': 'application/json' },
            });
            return;
        }

        const rawUrl = request.url || '';
        const rootPath = request.rootPath || '';
        // Strip the rootPath prefix to get the relative path
        const url = rawUrl.startsWith(rootPath) ? rawUrl.slice(rootPath.length) : rawUrl;
        const method = request.method || 'GET';

        if (method === 'GET' && url.startsWith('/api/status')) {
            return this.handleStatus(response);
        }

        if (method === 'POST' && url.startsWith('/api/cameras')) {
            return this.handleCreateCamera(request, response);
        }

        if (method === 'DELETE' && url.startsWith('/api/cameras')) {
            return this.handleDeleteCamera(request, response);
        }

        response.send(JSON.stringify({ error: 'Not found' }), {
            code: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // --- DeviceProvider ---

    private devices = new Map<string, ScrixCamera>();

    async getDevice(nativeId: ScryptedNativeId): Promise<any> {
        if (!nativeId) return undefined;
        let device = this.devices.get(nativeId);
        if (!device) {
            device = new ScrixCamera(nativeId);
            this.devices.set(nativeId, device);
        }
        return device;
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
        this.devices.delete(nativeId);
    }
}

class ScrixCamera extends ScryptedDeviceBase implements VideoCamera, Settings {
    constructor(nativeId: string) {
        super(nativeId);
    }

    async getVideoStream(options?: any): Promise<MediaObject> {
        const streamId = options?.id;
        let streamUrl: string | null;

        if (streamId === 'sub') {
            streamUrl = this.storage.getItem('subStreamUrl') || this.storage.getItem('mainStreamUrl');
        } else {
            streamUrl = this.storage.getItem('mainStreamUrl');
        }

        if (!streamUrl) {
            throw new Error('No stream URL configured for this camera');
        }

        const isRtsp = streamUrl.toLowerCase().startsWith('rtsp://');

        const ffmpegInput: FFmpegInput = {
            url: streamUrl,
            inputArguments: isRtsp
                ? ['-rtsp_transport', 'tcp', '-i', streamUrl]
                : ['-i', streamUrl],
        };

        return sdk.mediaManager.createFFmpegMediaObject(ffmpegInput);
    }

    async getVideoStreamOptions(): Promise<any[]> {
        const options: any[] = [];
        const mainUrl = this.storage.getItem('mainStreamUrl');
        const subUrl = this.storage.getItem('subStreamUrl');

        if (mainUrl) {
            options.push({
                id: 'main',
                name: 'Main Stream',
                video: { codec: 'h264' },
            });
        }
        if (subUrl) {
            options.push({
                id: 'sub',
                name: 'Sub Stream',
                video: { codec: 'h264' },
            });
        }
        return options;
    }

    async getSettings(): Promise<Setting[]> {
        return [
            {
                key: 'mainStreamUrl',
                title: 'Main Stream URL',
                value: this.storage.getItem('mainStreamUrl') || '',
                type: 'string',
            },
            {
                key: 'subStreamUrl',
                title: 'Sub Stream URL',
                value: this.storage.getItem('subStreamUrl') || '',
                type: 'string',
            },
            {
                key: 'username',
                title: 'Username',
                value: this.storage.getItem('username') || '',
                type: 'string',
            },
            {
                key: 'password',
                title: 'Password',
                value: this.storage.getItem('password') || '',
                type: 'password',
            },
        ];
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        this.storage.setItem(key, String(value));
    }
}

export default ScrixPlugin;
