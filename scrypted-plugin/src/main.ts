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
        response.send(JSON.stringify({ error: 'Not implemented' }), {
            code: 501,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    async getDevice(nativeId: ScryptedNativeId): Promise<any> {
        throw new Error('Not implemented');
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {}

    async getSettings(): Promise<Setting[]> {
        return [];
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {}
}

export default ScrixPlugin;
