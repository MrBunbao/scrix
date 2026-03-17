import crypto from 'crypto';
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
    constructor(nativeId?: string) {
        super(nativeId);
        if (!this.storage.getItem('apiKey')) {
            const key = crypto.randomBytes(32).toString('hex');
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
            const newKey = crypto.randomBytes(32).toString('hex');
            this.storage.setItem('apiKey', newKey);
            this.console.log('API key regenerated.');
        }
    }

    // --- Auth middleware ---

    private authenticate(request: HttpRequest): boolean {
        const auth = request.headers?.authorization;
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

    // --- HTTP handler ---

    async onRequest(request: HttpRequest, response: HttpResponse): Promise<void> {
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

    // --- DeviceProvider ---

    async getDevice(nativeId: ScryptedNativeId): Promise<any> {
        return new ScryptedDeviceBase(nativeId);
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {}
}

export default ScrixPlugin;
