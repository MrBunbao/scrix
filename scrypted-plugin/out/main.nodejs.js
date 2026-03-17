/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@scrypted/sdk/dist/src/index.js"
/*!******************************************************!*\
  !*** ./node_modules/@scrypted/sdk/dist/src/index.js ***!
  \******************************************************/
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.sdk = exports.MixinDeviceBase = exports.ScryptedDeviceBase = void 0;
__exportStar(__webpack_require__(/*! ../types/gen/index */ "./node_modules/@scrypted/sdk/dist/types/gen/index.js"), exports);
const fs_1 = __importDefault(__webpack_require__(/*! fs */ "fs"));
const index_1 = __webpack_require__(/*! ../types/gen/index */ "./node_modules/@scrypted/sdk/dist/types/gen/index.js");
const module_1 = __webpack_require__(/*! module */ "module");
/**
 * @category Core Reference
 */
class ScryptedDeviceBase extends index_1.DeviceBase {
    constructor(nativeId) {
        super();
        this.nativeId = nativeId;
    }
    get storage() {
        if (!this._storage) {
            this._storage = exports.sdk.deviceManager.getDeviceStorage(this.nativeId);
        }
        return this._storage;
    }
    get log() {
        if (!this._log) {
            this._log = exports.sdk.deviceManager.getDeviceLogger(this.nativeId);
        }
        return this._log;
    }
    get console() {
        if (!this._console) {
            this._console = exports.sdk.deviceManager.getDeviceConsole(this.nativeId);
        }
        return this._console;
    }
    async createMediaObject(data, mimeType) {
        return exports.sdk.mediaManager.createMediaObject(data, mimeType, {
            sourceId: this.id,
        });
    }
    getMediaObjectConsole(mediaObject) {
        if (typeof mediaObject.sourceId !== 'string')
            return this.console;
        return exports.sdk.deviceManager.getMixinConsole(mediaObject.sourceId, this.nativeId);
    }
    _lazyLoadDeviceState() {
        if (!this._deviceState) {
            if (this.nativeId) {
                this._deviceState = exports.sdk.deviceManager.getDeviceState(this.nativeId);
            }
            else {
                this._deviceState = exports.sdk.deviceManager.getDeviceState();
            }
        }
    }
    /**
     * Fire an event for this device.
     */
    onDeviceEvent(eventInterface, eventData) {
        return exports.sdk.deviceManager.onDeviceEvent(this.nativeId, eventInterface, eventData);
    }
}
exports.ScryptedDeviceBase = ScryptedDeviceBase;
/**
 * @category Mixin Reference
 */
class MixinDeviceBase extends index_1.DeviceBase {
    constructor(options) {
        super();
        this._listeners = new Set();
        this.mixinDevice = options.mixinDevice;
        this.mixinDeviceInterfaces = options.mixinDeviceInterfaces;
        this.mixinStorageSuffix = options.mixinStorageSuffix;
        this._deviceState = options.mixinDeviceState;
        this.nativeId = exports.sdk.systemManager.getDeviceById(this.id).nativeId;
        this.mixinProviderNativeId = options.mixinProviderNativeId;
        // RpcProxy will trap all properties, and the following check/hack will determine
        // if the device state came from another node worker thread.
        // This should ultimately be discouraged and warned at some point in the future.
        if (this._deviceState.__rpcproxy_traps_all_properties && typeof this._deviceState.id === 'string') {
            this._deviceState = exports.sdk.deviceManager.createDeviceState(this._deviceState.id, this._deviceState.setState);
        }
    }
    get storage() {
        if (!this._storage) {
            const mixinStorageSuffix = this.mixinStorageSuffix;
            const mixinStorageKey = this.id + (mixinStorageSuffix ? ':' + mixinStorageSuffix : '');
            this._storage = exports.sdk.deviceManager.getMixinStorage(mixinStorageKey, this.mixinProviderNativeId);
        }
        return this._storage;
    }
    get console() {
        if (!this._console) {
            if (exports.sdk.deviceManager.getMixinConsole)
                this._console = exports.sdk.deviceManager.getMixinConsole(this.id, this.mixinProviderNativeId);
            else
                this._console = exports.sdk.deviceManager.getDeviceConsole(this.mixinProviderNativeId);
        }
        return this._console;
    }
    async createMediaObject(data, mimeType) {
        return exports.sdk.mediaManager.createMediaObject(data, mimeType, {
            sourceId: this.id,
        });
    }
    getMediaObjectConsole(mediaObject) {
        if (typeof mediaObject.sourceId !== 'string')
            return this.console;
        return exports.sdk.deviceManager.getMixinConsole(mediaObject.sourceId, this.mixinProviderNativeId);
    }
    /**
     * Fire an event for this device.
     */
    onDeviceEvent(eventInterface, eventData) {
        return exports.sdk.deviceManager.onMixinEvent(this.id, this, eventInterface, eventData);
    }
    _lazyLoadDeviceState() {
    }
    manageListener(listener) {
        this._listeners.add(listener);
    }
    release() {
        for (const l of this._listeners) {
            l.removeListener();
        }
    }
}
exports.MixinDeviceBase = MixinDeviceBase;
(function () {
    function _createGetState(state) {
        return function () {
            this._lazyLoadDeviceState();
            // @ts-ignore: accessing private property
            return this._deviceState?.[state];
        };
    }
    function _createSetState(state) {
        return function (value) {
            this._lazyLoadDeviceState();
            // @ts-ignore: accessing private property
            if (!this._deviceState) {
                console.warn('device state is unavailable. the device must be discovered with deviceManager.onDeviceDiscovered or deviceManager.onDevicesChanged before the state can be set.');
            }
            else {
                // @ts-ignore: accessing private property
                this._deviceState[state] = value;
            }
        };
    }
    for (const field of Object.values(index_1.ScryptedInterfaceProperty)) {
        if (field === index_1.ScryptedInterfaceProperty.nativeId)
            continue;
        Object.defineProperty(ScryptedDeviceBase.prototype, field, {
            set: _createSetState(field),
            get: _createGetState(field),
        });
        Object.defineProperty(MixinDeviceBase.prototype, field, {
            set: _createSetState(field),
            get: _createGetState(field),
        });
    }
})();
exports.sdk = {};
try {
    let loaded = false;
    try {
        // todo: remove usage of process.env.SCRYPTED_SDK_MODULE, only existed in prerelease builds.
        // import.meta is not a reliable way to detect es module support in webpack since webpack
        // evaluates that to true at runtime.
        const esModule = process.env.SCRYPTED_SDK_ES_MODULE || process.env.SCRYPTED_SDK_MODULE;
        const cjsModule = process.env.SCRYPTED_SDK_CJS_MODULE || process.env.SCRYPTED_SDK_MODULE;
        // @ts-expect-error
        if (esModule && "undefined" !== 'undefined') // removed by dead control flow
{}
        else if (cjsModule) {
            // @ts-expect-error
            if (typeof require !== 'undefined') {
                // @ts-expect-error
                const sdkModule = require(process.env.SCRYPTED_SDK_MODULE);
                Object.assign(exports.sdk, sdkModule.getScryptedStatic());
                loaded = true;
            }
            else {
                const sdkModule = __webpack_require__("./node_modules/@scrypted/sdk/dist/src sync recursive")(cjsModule);
                Object.assign(exports.sdk, sdkModule.getScryptedStatic());
                loaded = true;
            }
        }
    }
    catch (e) {
        console.warn("failed to load sdk module", e);
        throw e;
    }
    if (!loaded) {
        let runtimeAPI;
        try {
            runtimeAPI = pluginRuntimeAPI;
        }
        catch (e) {
        }
        Object.assign(exports.sdk, {
            log: deviceManager.getDeviceLogger(undefined),
            deviceManager,
            endpointManager,
            mediaManager,
            systemManager,
            pluginHostAPI,
            ...runtimeAPI,
        });
    }
    try {
        let descriptors = {
            ...index_1.ScryptedInterfaceDescriptors,
        };
        try {
            const sdkJson = JSON.parse(fs_1.default.readFileSync('../sdk.json').toString());
            const customDescriptors = sdkJson.interfaceDescriptors;
            if (customDescriptors) {
                descriptors = {
                    ...descriptors,
                    ...customDescriptors,
                };
            }
        }
        catch (e) {
            console.warn('failed to load custom interface descriptors', e);
        }
        exports.sdk.systemManager.setScryptedInterfaceDescriptors?.(index_1.TYPES_VERSION, descriptors)?.catch(() => { });
    }
    catch (e) {
    }
}
catch (e) {
    console.error('sdk initialization error, import @scrypted/types or use @scrypted/client instead', e);
}
exports["default"] = exports.sdk;
//# sourceMappingURL=index.js.map

/***/ },

/***/ "./node_modules/@scrypted/sdk/dist/src sync recursive"
/*!***************************************************!*\
  !*** ./node_modules/@scrypted/sdk/dist/src/ sync ***!
  \***************************************************/
(module) {

function webpackEmptyContext(req) {
	var e = new Error("Cannot find module '" + req + "'");
	e.code = 'MODULE_NOT_FOUND';
	throw e;
}
webpackEmptyContext.keys = () => ([]);
webpackEmptyContext.resolve = webpackEmptyContext;
webpackEmptyContext.id = "./node_modules/@scrypted/sdk/dist/src sync recursive";
module.exports = webpackEmptyContext;

/***/ },

/***/ "./node_modules/@scrypted/sdk/dist/types/gen/index.js"
/*!************************************************************!*\
  !*** ./node_modules/@scrypted/sdk/dist/types/gen/index.js ***!
  \************************************************************/
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ScryptedMimeTypes = exports.ScryptedInterface = exports.MediaPlayerState = exports.SecuritySystemObstruction = exports.SecuritySystemMode = exports.AirQuality = exports.AirPurifierMode = exports.AirPurifierStatus = exports.ChargeState = exports.LockState = exports.PanTiltZoomMovement = exports.ThermostatMode = exports.TemperatureUnit = exports.FanMode = exports.HumidityMode = exports.ScryptedDeviceType = exports.ScryptedInterfaceDescriptors = exports.ScryptedInterfaceMethod = exports.ScryptedInterfaceProperty = exports.DeviceBase = exports.TYPES_VERSION = void 0;
exports.TYPES_VERSION = "0.5.53";
class DeviceBase {
}
exports.DeviceBase = DeviceBase;
var ScryptedInterfaceProperty;
(function (ScryptedInterfaceProperty) {
    ScryptedInterfaceProperty["id"] = "id";
    ScryptedInterfaceProperty["info"] = "info";
    ScryptedInterfaceProperty["interfaces"] = "interfaces";
    ScryptedInterfaceProperty["mixins"] = "mixins";
    ScryptedInterfaceProperty["name"] = "name";
    ScryptedInterfaceProperty["nativeId"] = "nativeId";
    ScryptedInterfaceProperty["pluginId"] = "pluginId";
    ScryptedInterfaceProperty["providedInterfaces"] = "providedInterfaces";
    ScryptedInterfaceProperty["providedName"] = "providedName";
    ScryptedInterfaceProperty["providedRoom"] = "providedRoom";
    ScryptedInterfaceProperty["providedType"] = "providedType";
    ScryptedInterfaceProperty["providerId"] = "providerId";
    ScryptedInterfaceProperty["room"] = "room";
    ScryptedInterfaceProperty["type"] = "type";
    ScryptedInterfaceProperty["scryptedRuntimeArguments"] = "scryptedRuntimeArguments";
    ScryptedInterfaceProperty["on"] = "on";
    ScryptedInterfaceProperty["brightness"] = "brightness";
    ScryptedInterfaceProperty["colorTemperature"] = "colorTemperature";
    ScryptedInterfaceProperty["rgb"] = "rgb";
    ScryptedInterfaceProperty["hsv"] = "hsv";
    ScryptedInterfaceProperty["buttons"] = "buttons";
    ScryptedInterfaceProperty["sensors"] = "sensors";
    ScryptedInterfaceProperty["running"] = "running";
    ScryptedInterfaceProperty["paused"] = "paused";
    ScryptedInterfaceProperty["docked"] = "docked";
    ScryptedInterfaceProperty["temperatureSetting"] = "temperatureSetting";
    ScryptedInterfaceProperty["temperature"] = "temperature";
    ScryptedInterfaceProperty["temperatureUnit"] = "temperatureUnit";
    ScryptedInterfaceProperty["humidity"] = "humidity";
    ScryptedInterfaceProperty["resolution"] = "resolution";
    ScryptedInterfaceProperty["audioVolumes"] = "audioVolumes";
    ScryptedInterfaceProperty["recordingActive"] = "recordingActive";
    ScryptedInterfaceProperty["ptzCapabilities"] = "ptzCapabilities";
    ScryptedInterfaceProperty["lockState"] = "lockState";
    ScryptedInterfaceProperty["entryOpen"] = "entryOpen";
    ScryptedInterfaceProperty["batteryLevel"] = "batteryLevel";
    ScryptedInterfaceProperty["chargeState"] = "chargeState";
    ScryptedInterfaceProperty["online"] = "online";
    ScryptedInterfaceProperty["fromMimeType"] = "fromMimeType";
    ScryptedInterfaceProperty["toMimeType"] = "toMimeType";
    ScryptedInterfaceProperty["converters"] = "converters";
    ScryptedInterfaceProperty["binaryState"] = "binaryState";
    ScryptedInterfaceProperty["tampered"] = "tampered";
    ScryptedInterfaceProperty["sleeping"] = "sleeping";
    ScryptedInterfaceProperty["powerDetected"] = "powerDetected";
    ScryptedInterfaceProperty["audioDetected"] = "audioDetected";
    ScryptedInterfaceProperty["motionDetected"] = "motionDetected";
    ScryptedInterfaceProperty["ambientLight"] = "ambientLight";
    ScryptedInterfaceProperty["occupied"] = "occupied";
    ScryptedInterfaceProperty["flooded"] = "flooded";
    ScryptedInterfaceProperty["ultraviolet"] = "ultraviolet";
    ScryptedInterfaceProperty["luminance"] = "luminance";
    ScryptedInterfaceProperty["position"] = "position";
    ScryptedInterfaceProperty["securitySystemState"] = "securitySystemState";
    ScryptedInterfaceProperty["pm10Density"] = "pm10Density";
    ScryptedInterfaceProperty["pm25Density"] = "pm25Density";
    ScryptedInterfaceProperty["vocDensity"] = "vocDensity";
    ScryptedInterfaceProperty["noxDensity"] = "noxDensity";
    ScryptedInterfaceProperty["co2ppm"] = "co2ppm";
    ScryptedInterfaceProperty["airQuality"] = "airQuality";
    ScryptedInterfaceProperty["airPurifierState"] = "airPurifierState";
    ScryptedInterfaceProperty["filterChangeIndication"] = "filterChangeIndication";
    ScryptedInterfaceProperty["filterLifeLevel"] = "filterLifeLevel";
    ScryptedInterfaceProperty["humiditySetting"] = "humiditySetting";
    ScryptedInterfaceProperty["fan"] = "fan";
    ScryptedInterfaceProperty["applicationInfo"] = "applicationInfo";
    ScryptedInterfaceProperty["chatCompletionCapabilities"] = "chatCompletionCapabilities";
    ScryptedInterfaceProperty["systemDevice"] = "systemDevice";
})(ScryptedInterfaceProperty || (exports.ScryptedInterfaceProperty = ScryptedInterfaceProperty = {}));
var ScryptedInterfaceMethod;
(function (ScryptedInterfaceMethod) {
    ScryptedInterfaceMethod["listen"] = "listen";
    ScryptedInterfaceMethod["probe"] = "probe";
    ScryptedInterfaceMethod["setMixins"] = "setMixins";
    ScryptedInterfaceMethod["setName"] = "setName";
    ScryptedInterfaceMethod["setRoom"] = "setRoom";
    ScryptedInterfaceMethod["setType"] = "setType";
    ScryptedInterfaceMethod["getPluginJson"] = "getPluginJson";
    ScryptedInterfaceMethod["turnOff"] = "turnOff";
    ScryptedInterfaceMethod["turnOn"] = "turnOn";
    ScryptedInterfaceMethod["setBrightness"] = "setBrightness";
    ScryptedInterfaceMethod["getTemperatureMaxK"] = "getTemperatureMaxK";
    ScryptedInterfaceMethod["getTemperatureMinK"] = "getTemperatureMinK";
    ScryptedInterfaceMethod["setColorTemperature"] = "setColorTemperature";
    ScryptedInterfaceMethod["setRgb"] = "setRgb";
    ScryptedInterfaceMethod["setHsv"] = "setHsv";
    ScryptedInterfaceMethod["pressButton"] = "pressButton";
    ScryptedInterfaceMethod["sendNotification"] = "sendNotification";
    ScryptedInterfaceMethod["start"] = "start";
    ScryptedInterfaceMethod["stop"] = "stop";
    ScryptedInterfaceMethod["pause"] = "pause";
    ScryptedInterfaceMethod["resume"] = "resume";
    ScryptedInterfaceMethod["dock"] = "dock";
    ScryptedInterfaceMethod["setTemperature"] = "setTemperature";
    ScryptedInterfaceMethod["setTemperatureUnit"] = "setTemperatureUnit";
    ScryptedInterfaceMethod["getPictureOptions"] = "getPictureOptions";
    ScryptedInterfaceMethod["takePicture"] = "takePicture";
    ScryptedInterfaceMethod["getAudioStream"] = "getAudioStream";
    ScryptedInterfaceMethod["setAudioVolumes"] = "setAudioVolumes";
    ScryptedInterfaceMethod["startDisplay"] = "startDisplay";
    ScryptedInterfaceMethod["stopDisplay"] = "stopDisplay";
    ScryptedInterfaceMethod["getVideoStream"] = "getVideoStream";
    ScryptedInterfaceMethod["getVideoStreamOptions"] = "getVideoStreamOptions";
    ScryptedInterfaceMethod["getPrivacyMasks"] = "getPrivacyMasks";
    ScryptedInterfaceMethod["setPrivacyMasks"] = "setPrivacyMasks";
    ScryptedInterfaceMethod["getVideoTextOverlays"] = "getVideoTextOverlays";
    ScryptedInterfaceMethod["setVideoTextOverlay"] = "setVideoTextOverlay";
    ScryptedInterfaceMethod["getRecordingStream"] = "getRecordingStream";
    ScryptedInterfaceMethod["getRecordingStreamCurrentTime"] = "getRecordingStreamCurrentTime";
    ScryptedInterfaceMethod["getRecordingStreamOptions"] = "getRecordingStreamOptions";
    ScryptedInterfaceMethod["getRecordingStreamThumbnail"] = "getRecordingStreamThumbnail";
    ScryptedInterfaceMethod["deleteRecordingStream"] = "deleteRecordingStream";
    ScryptedInterfaceMethod["setRecordingActive"] = "setRecordingActive";
    ScryptedInterfaceMethod["ptzCommand"] = "ptzCommand";
    ScryptedInterfaceMethod["getRecordedEvents"] = "getRecordedEvents";
    ScryptedInterfaceMethod["getVideoClip"] = "getVideoClip";
    ScryptedInterfaceMethod["getVideoClips"] = "getVideoClips";
    ScryptedInterfaceMethod["getVideoClipThumbnail"] = "getVideoClipThumbnail";
    ScryptedInterfaceMethod["removeVideoClips"] = "removeVideoClips";
    ScryptedInterfaceMethod["setVideoStreamOptions"] = "setVideoStreamOptions";
    ScryptedInterfaceMethod["startIntercom"] = "startIntercom";
    ScryptedInterfaceMethod["stopIntercom"] = "stopIntercom";
    ScryptedInterfaceMethod["lock"] = "lock";
    ScryptedInterfaceMethod["unlock"] = "unlock";
    ScryptedInterfaceMethod["addPassword"] = "addPassword";
    ScryptedInterfaceMethod["getPasswords"] = "getPasswords";
    ScryptedInterfaceMethod["removePassword"] = "removePassword";
    ScryptedInterfaceMethod["activate"] = "activate";
    ScryptedInterfaceMethod["deactivate"] = "deactivate";
    ScryptedInterfaceMethod["isReversible"] = "isReversible";
    ScryptedInterfaceMethod["closeEntry"] = "closeEntry";
    ScryptedInterfaceMethod["openEntry"] = "openEntry";
    ScryptedInterfaceMethod["getDevice"] = "getDevice";
    ScryptedInterfaceMethod["releaseDevice"] = "releaseDevice";
    ScryptedInterfaceMethod["adoptDevice"] = "adoptDevice";
    ScryptedInterfaceMethod["discoverDevices"] = "discoverDevices";
    ScryptedInterfaceMethod["createDevice"] = "createDevice";
    ScryptedInterfaceMethod["getCreateDeviceSettings"] = "getCreateDeviceSettings";
    ScryptedInterfaceMethod["reboot"] = "reboot";
    ScryptedInterfaceMethod["getRefreshFrequency"] = "getRefreshFrequency";
    ScryptedInterfaceMethod["refresh"] = "refresh";
    ScryptedInterfaceMethod["getMediaStatus"] = "getMediaStatus";
    ScryptedInterfaceMethod["load"] = "load";
    ScryptedInterfaceMethod["seek"] = "seek";
    ScryptedInterfaceMethod["skipNext"] = "skipNext";
    ScryptedInterfaceMethod["skipPrevious"] = "skipPrevious";
    ScryptedInterfaceMethod["convert"] = "convert";
    ScryptedInterfaceMethod["convertMedia"] = "convertMedia";
    ScryptedInterfaceMethod["getSettings"] = "getSettings";
    ScryptedInterfaceMethod["putSetting"] = "putSetting";
    ScryptedInterfaceMethod["armSecuritySystem"] = "armSecuritySystem";
    ScryptedInterfaceMethod["disarmSecuritySystem"] = "disarmSecuritySystem";
    ScryptedInterfaceMethod["setAirPurifierState"] = "setAirPurifierState";
    ScryptedInterfaceMethod["getReadmeMarkdown"] = "getReadmeMarkdown";
    ScryptedInterfaceMethod["getOauthUrl"] = "getOauthUrl";
    ScryptedInterfaceMethod["onOauthCallback"] = "onOauthCallback";
    ScryptedInterfaceMethod["canMixin"] = "canMixin";
    ScryptedInterfaceMethod["getMixin"] = "getMixin";
    ScryptedInterfaceMethod["releaseMixin"] = "releaseMixin";
    ScryptedInterfaceMethod["onRequest"] = "onRequest";
    ScryptedInterfaceMethod["onConnection"] = "onConnection";
    ScryptedInterfaceMethod["onPush"] = "onPush";
    ScryptedInterfaceMethod["run"] = "run";
    ScryptedInterfaceMethod["eval"] = "eval";
    ScryptedInterfaceMethod["loadScripts"] = "loadScripts";
    ScryptedInterfaceMethod["saveScript"] = "saveScript";
    ScryptedInterfaceMethod["forkInterface"] = "forkInterface";
    ScryptedInterfaceMethod["getDetectionInput"] = "getDetectionInput";
    ScryptedInterfaceMethod["getObjectTypes"] = "getObjectTypes";
    ScryptedInterfaceMethod["detectObjects"] = "detectObjects";
    ScryptedInterfaceMethod["generateObjectDetections"] = "generateObjectDetections";
    ScryptedInterfaceMethod["getDetectionModel"] = "getDetectionModel";
    ScryptedInterfaceMethod["setHumidity"] = "setHumidity";
    ScryptedInterfaceMethod["setFan"] = "setFan";
    ScryptedInterfaceMethod["startRTCSignalingSession"] = "startRTCSignalingSession";
    ScryptedInterfaceMethod["createRTCSignalingSession"] = "createRTCSignalingSession";
    ScryptedInterfaceMethod["getScryptedUserAccessControl"] = "getScryptedUserAccessControl";
    ScryptedInterfaceMethod["generateVideoFrames"] = "generateVideoFrames";
    ScryptedInterfaceMethod["connectStream"] = "connectStream";
    ScryptedInterfaceMethod["getTTYSettings"] = "getTTYSettings";
    ScryptedInterfaceMethod["getChatCompletion"] = "getChatCompletion";
    ScryptedInterfaceMethod["streamChatCompletion"] = "streamChatCompletion";
    ScryptedInterfaceMethod["getTextEmbedding"] = "getTextEmbedding";
    ScryptedInterfaceMethod["getImageEmbedding"] = "getImageEmbedding";
    ScryptedInterfaceMethod["callLLMTool"] = "callLLMTool";
    ScryptedInterfaceMethod["getLLMTools"] = "getLLMTools";
})(ScryptedInterfaceMethod || (exports.ScryptedInterfaceMethod = ScryptedInterfaceMethod = {}));
exports.ScryptedInterfaceDescriptors = {
    "ScryptedDevice": {
        "name": "ScryptedDevice",
        "methods": [
            "listen",
            "probe",
            "setMixins",
            "setName",
            "setRoom",
            "setType"
        ],
        "properties": [
            "id",
            "info",
            "interfaces",
            "mixins",
            "name",
            "nativeId",
            "pluginId",
            "providedInterfaces",
            "providedName",
            "providedRoom",
            "providedType",
            "providerId",
            "room",
            "type"
        ]
    },
    "ScryptedPlugin": {
        "name": "ScryptedPlugin",
        "methods": [
            "getPluginJson"
        ],
        "properties": []
    },
    "ScryptedPluginRuntime": {
        "name": "ScryptedPluginRuntime",
        "methods": [],
        "properties": [
            "scryptedRuntimeArguments"
        ]
    },
    "OnOff": {
        "name": "OnOff",
        "methods": [
            "turnOff",
            "turnOn"
        ],
        "properties": [
            "on"
        ]
    },
    "Brightness": {
        "name": "Brightness",
        "methods": [
            "setBrightness"
        ],
        "properties": [
            "brightness"
        ]
    },
    "ColorSettingTemperature": {
        "name": "ColorSettingTemperature",
        "methods": [
            "getTemperatureMaxK",
            "getTemperatureMinK",
            "setColorTemperature"
        ],
        "properties": [
            "colorTemperature"
        ]
    },
    "ColorSettingRgb": {
        "name": "ColorSettingRgb",
        "methods": [
            "setRgb"
        ],
        "properties": [
            "rgb"
        ]
    },
    "ColorSettingHsv": {
        "name": "ColorSettingHsv",
        "methods": [
            "setHsv"
        ],
        "properties": [
            "hsv"
        ]
    },
    "Buttons": {
        "name": "Buttons",
        "methods": [],
        "properties": [
            "buttons"
        ]
    },
    "PressButtons": {
        "name": "PressButtons",
        "methods": [
            "pressButton"
        ],
        "properties": []
    },
    "Sensors": {
        "name": "Sensors",
        "methods": [],
        "properties": [
            "sensors"
        ]
    },
    "Notifier": {
        "name": "Notifier",
        "methods": [
            "sendNotification"
        ],
        "properties": []
    },
    "StartStop": {
        "name": "StartStop",
        "methods": [
            "start",
            "stop"
        ],
        "properties": [
            "running"
        ]
    },
    "Pause": {
        "name": "Pause",
        "methods": [
            "pause",
            "resume"
        ],
        "properties": [
            "paused"
        ]
    },
    "Dock": {
        "name": "Dock",
        "methods": [
            "dock"
        ],
        "properties": [
            "docked"
        ]
    },
    "TemperatureSetting": {
        "name": "TemperatureSetting",
        "methods": [
            "setTemperature"
        ],
        "properties": [
            "temperatureSetting"
        ]
    },
    "Thermometer": {
        "name": "Thermometer",
        "methods": [
            "setTemperatureUnit"
        ],
        "properties": [
            "temperature",
            "temperatureUnit"
        ]
    },
    "HumiditySensor": {
        "name": "HumiditySensor",
        "methods": [],
        "properties": [
            "humidity"
        ]
    },
    "Camera": {
        "name": "Camera",
        "methods": [
            "getPictureOptions",
            "takePicture"
        ],
        "properties": []
    },
    "Resolution": {
        "name": "Resolution",
        "methods": [],
        "properties": [
            "resolution"
        ]
    },
    "Microphone": {
        "name": "Microphone",
        "methods": [
            "getAudioStream"
        ],
        "properties": []
    },
    "AudioVolumeControl": {
        "name": "AudioVolumeControl",
        "methods": [
            "setAudioVolumes"
        ],
        "properties": [
            "audioVolumes"
        ]
    },
    "Display": {
        "name": "Display",
        "methods": [
            "startDisplay",
            "stopDisplay"
        ],
        "properties": []
    },
    "VideoCamera": {
        "name": "VideoCamera",
        "methods": [
            "getVideoStream",
            "getVideoStreamOptions"
        ],
        "properties": []
    },
    "VideoCameraMask": {
        "name": "VideoCameraMask",
        "methods": [
            "getPrivacyMasks",
            "setPrivacyMasks"
        ],
        "properties": []
    },
    "VideoTextOverlays": {
        "name": "VideoTextOverlays",
        "methods": [
            "getVideoTextOverlays",
            "setVideoTextOverlay"
        ],
        "properties": []
    },
    "VideoRecorder": {
        "name": "VideoRecorder",
        "methods": [
            "getRecordingStream",
            "getRecordingStreamCurrentTime",
            "getRecordingStreamOptions",
            "getRecordingStreamThumbnail"
        ],
        "properties": [
            "recordingActive"
        ]
    },
    "VideoRecorderManagement": {
        "name": "VideoRecorderManagement",
        "methods": [
            "deleteRecordingStream",
            "setRecordingActive"
        ],
        "properties": []
    },
    "PanTiltZoom": {
        "name": "PanTiltZoom",
        "methods": [
            "ptzCommand"
        ],
        "properties": [
            "ptzCapabilities"
        ]
    },
    "EventRecorder": {
        "name": "EventRecorder",
        "methods": [
            "getRecordedEvents"
        ],
        "properties": []
    },
    "VideoClips": {
        "name": "VideoClips",
        "methods": [
            "getVideoClip",
            "getVideoClips",
            "getVideoClipThumbnail",
            "removeVideoClips"
        ],
        "properties": []
    },
    "VideoCameraConfiguration": {
        "name": "VideoCameraConfiguration",
        "methods": [
            "setVideoStreamOptions"
        ],
        "properties": []
    },
    "Intercom": {
        "name": "Intercom",
        "methods": [
            "startIntercom",
            "stopIntercom"
        ],
        "properties": []
    },
    "Lock": {
        "name": "Lock",
        "methods": [
            "lock",
            "unlock"
        ],
        "properties": [
            "lockState"
        ]
    },
    "PasswordStore": {
        "name": "PasswordStore",
        "methods": [
            "addPassword",
            "getPasswords",
            "removePassword"
        ],
        "properties": []
    },
    "Scene": {
        "name": "Scene",
        "methods": [
            "activate",
            "deactivate",
            "isReversible"
        ],
        "properties": []
    },
    "Entry": {
        "name": "Entry",
        "methods": [
            "closeEntry",
            "openEntry"
        ],
        "properties": []
    },
    "EntrySensor": {
        "name": "EntrySensor",
        "methods": [],
        "properties": [
            "entryOpen"
        ]
    },
    "DeviceProvider": {
        "name": "DeviceProvider",
        "methods": [
            "getDevice",
            "releaseDevice"
        ],
        "properties": []
    },
    "DeviceDiscovery": {
        "name": "DeviceDiscovery",
        "methods": [
            "adoptDevice",
            "discoverDevices"
        ],
        "properties": []
    },
    "DeviceCreator": {
        "name": "DeviceCreator",
        "methods": [
            "createDevice",
            "getCreateDeviceSettings"
        ],
        "properties": []
    },
    "Battery": {
        "name": "Battery",
        "methods": [],
        "properties": [
            "batteryLevel"
        ]
    },
    "Charger": {
        "name": "Charger",
        "methods": [],
        "properties": [
            "chargeState"
        ]
    },
    "Reboot": {
        "name": "Reboot",
        "methods": [
            "reboot"
        ],
        "properties": []
    },
    "Refresh": {
        "name": "Refresh",
        "methods": [
            "getRefreshFrequency",
            "refresh"
        ],
        "properties": []
    },
    "MediaPlayer": {
        "name": "MediaPlayer",
        "methods": [
            "getMediaStatus",
            "load",
            "seek",
            "skipNext",
            "skipPrevious"
        ],
        "properties": []
    },
    "Online": {
        "name": "Online",
        "methods": [],
        "properties": [
            "online"
        ]
    },
    "BufferConverter": {
        "name": "BufferConverter",
        "methods": [
            "convert"
        ],
        "properties": [
            "fromMimeType",
            "toMimeType"
        ]
    },
    "MediaConverter": {
        "name": "MediaConverter",
        "methods": [
            "convertMedia"
        ],
        "properties": [
            "converters"
        ]
    },
    "Settings": {
        "name": "Settings",
        "methods": [
            "getSettings",
            "putSetting"
        ],
        "properties": []
    },
    "BinarySensor": {
        "name": "BinarySensor",
        "methods": [],
        "properties": [
            "binaryState"
        ]
    },
    "TamperSensor": {
        "name": "TamperSensor",
        "methods": [],
        "properties": [
            "tampered"
        ]
    },
    "Sleep": {
        "name": "Sleep",
        "methods": [],
        "properties": [
            "sleeping"
        ]
    },
    "PowerSensor": {
        "name": "PowerSensor",
        "methods": [],
        "properties": [
            "powerDetected"
        ]
    },
    "AudioSensor": {
        "name": "AudioSensor",
        "methods": [],
        "properties": [
            "audioDetected"
        ]
    },
    "MotionSensor": {
        "name": "MotionSensor",
        "methods": [],
        "properties": [
            "motionDetected"
        ]
    },
    "AmbientLightSensor": {
        "name": "AmbientLightSensor",
        "methods": [],
        "properties": [
            "ambientLight"
        ]
    },
    "OccupancySensor": {
        "name": "OccupancySensor",
        "methods": [],
        "properties": [
            "occupied"
        ]
    },
    "FloodSensor": {
        "name": "FloodSensor",
        "methods": [],
        "properties": [
            "flooded"
        ]
    },
    "UltravioletSensor": {
        "name": "UltravioletSensor",
        "methods": [],
        "properties": [
            "ultraviolet"
        ]
    },
    "LuminanceSensor": {
        "name": "LuminanceSensor",
        "methods": [],
        "properties": [
            "luminance"
        ]
    },
    "PositionSensor": {
        "name": "PositionSensor",
        "methods": [],
        "properties": [
            "position"
        ]
    },
    "SecuritySystem": {
        "name": "SecuritySystem",
        "methods": [
            "armSecuritySystem",
            "disarmSecuritySystem"
        ],
        "properties": [
            "securitySystemState"
        ]
    },
    "PM10Sensor": {
        "name": "PM10Sensor",
        "methods": [],
        "properties": [
            "pm10Density"
        ]
    },
    "PM25Sensor": {
        "name": "PM25Sensor",
        "methods": [],
        "properties": [
            "pm25Density"
        ]
    },
    "VOCSensor": {
        "name": "VOCSensor",
        "methods": [],
        "properties": [
            "vocDensity"
        ]
    },
    "NOXSensor": {
        "name": "NOXSensor",
        "methods": [],
        "properties": [
            "noxDensity"
        ]
    },
    "CO2Sensor": {
        "name": "CO2Sensor",
        "methods": [],
        "properties": [
            "co2ppm"
        ]
    },
    "AirQualitySensor": {
        "name": "AirQualitySensor",
        "methods": [],
        "properties": [
            "airQuality"
        ]
    },
    "AirPurifier": {
        "name": "AirPurifier",
        "methods": [
            "setAirPurifierState"
        ],
        "properties": [
            "airPurifierState"
        ]
    },
    "FilterMaintenance": {
        "name": "FilterMaintenance",
        "methods": [],
        "properties": [
            "filterChangeIndication",
            "filterLifeLevel"
        ]
    },
    "Readme": {
        "name": "Readme",
        "methods": [
            "getReadmeMarkdown"
        ],
        "properties": []
    },
    "OauthClient": {
        "name": "OauthClient",
        "methods": [
            "getOauthUrl",
            "onOauthCallback"
        ],
        "properties": []
    },
    "MixinProvider": {
        "name": "MixinProvider",
        "methods": [
            "canMixin",
            "getMixin",
            "releaseMixin"
        ],
        "properties": []
    },
    "HttpRequestHandler": {
        "name": "HttpRequestHandler",
        "methods": [
            "onRequest"
        ],
        "properties": []
    },
    "EngineIOHandler": {
        "name": "EngineIOHandler",
        "methods": [
            "onConnection"
        ],
        "properties": []
    },
    "PushHandler": {
        "name": "PushHandler",
        "methods": [
            "onPush"
        ],
        "properties": []
    },
    "Program": {
        "name": "Program",
        "methods": [
            "run"
        ],
        "properties": []
    },
    "Scriptable": {
        "name": "Scriptable",
        "methods": [
            "eval",
            "loadScripts",
            "saveScript"
        ],
        "properties": []
    },
    "ClusterForkInterface": {
        "name": "ClusterForkInterface",
        "methods": [
            "forkInterface"
        ],
        "properties": []
    },
    "ObjectDetector": {
        "name": "ObjectDetector",
        "methods": [
            "getDetectionInput",
            "getObjectTypes"
        ],
        "properties": []
    },
    "ObjectDetection": {
        "name": "ObjectDetection",
        "methods": [
            "detectObjects",
            "generateObjectDetections",
            "getDetectionModel"
        ],
        "properties": []
    },
    "ObjectDetectionPreview": {
        "name": "ObjectDetectionPreview",
        "methods": [],
        "properties": []
    },
    "ObjectDetectionGenerator": {
        "name": "ObjectDetectionGenerator",
        "methods": [],
        "properties": []
    },
    "HumiditySetting": {
        "name": "HumiditySetting",
        "methods": [
            "setHumidity"
        ],
        "properties": [
            "humiditySetting"
        ]
    },
    "Fan": {
        "name": "Fan",
        "methods": [
            "setFan"
        ],
        "properties": [
            "fan"
        ]
    },
    "RTCSignalingChannel": {
        "name": "RTCSignalingChannel",
        "methods": [
            "startRTCSignalingSession"
        ],
        "properties": []
    },
    "RTCSignalingClient": {
        "name": "RTCSignalingClient",
        "methods": [
            "createRTCSignalingSession"
        ],
        "properties": []
    },
    "LauncherApplication": {
        "name": "LauncherApplication",
        "methods": [],
        "properties": [
            "applicationInfo"
        ]
    },
    "ScryptedUser": {
        "name": "ScryptedUser",
        "methods": [
            "getScryptedUserAccessControl"
        ],
        "properties": []
    },
    "VideoFrameGenerator": {
        "name": "VideoFrameGenerator",
        "methods": [
            "generateVideoFrames"
        ],
        "properties": []
    },
    "StreamService": {
        "name": "StreamService",
        "methods": [
            "connectStream"
        ],
        "properties": []
    },
    "TTY": {
        "name": "TTY",
        "methods": [],
        "properties": []
    },
    "TTYSettings": {
        "name": "TTYSettings",
        "methods": [
            "getTTYSettings"
        ],
        "properties": []
    },
    "ChatCompletion": {
        "name": "ChatCompletion",
        "methods": [
            "getChatCompletion",
            "streamChatCompletion"
        ],
        "properties": [
            "chatCompletionCapabilities"
        ]
    },
    "TextEmbedding": {
        "name": "TextEmbedding",
        "methods": [
            "getTextEmbedding"
        ],
        "properties": []
    },
    "ImageEmbedding": {
        "name": "ImageEmbedding",
        "methods": [
            "getImageEmbedding"
        ],
        "properties": []
    },
    "LLMTools": {
        "name": "LLMTools",
        "methods": [
            "callLLMTool",
            "getLLMTools"
        ],
        "properties": []
    },
    "ScryptedSystemDevice": {
        "name": "ScryptedSystemDevice",
        "methods": [],
        "properties": [
            "systemDevice"
        ]
    },
    "ScryptedDeviceCreator": {
        "name": "ScryptedDeviceCreator",
        "methods": [],
        "properties": []
    },
    "ScryptedSettings": {
        "name": "ScryptedSettings",
        "methods": [],
        "properties": []
    }
};
/**
 * @category Core Reference
 */
var ScryptedDeviceType;
(function (ScryptedDeviceType) {
    /**
     * @deprecated
     */
    ScryptedDeviceType["Builtin"] = "Builtin";
    /**
     * Internal devices will not show up in device lists unless explicitly searched.
     */
    ScryptedDeviceType["Internal"] = "Internal";
    ScryptedDeviceType["Camera"] = "Camera";
    ScryptedDeviceType["Fan"] = "Fan";
    ScryptedDeviceType["Light"] = "Light";
    ScryptedDeviceType["Switch"] = "Switch";
    ScryptedDeviceType["Outlet"] = "Outlet";
    ScryptedDeviceType["Sensor"] = "Sensor";
    ScryptedDeviceType["Scene"] = "Scene";
    ScryptedDeviceType["Program"] = "Program";
    ScryptedDeviceType["Automation"] = "Automation";
    ScryptedDeviceType["Vacuum"] = "Vacuum";
    ScryptedDeviceType["Notifier"] = "Notifier";
    ScryptedDeviceType["Thermostat"] = "Thermostat";
    ScryptedDeviceType["Lock"] = "Lock";
    ScryptedDeviceType["PasswordControl"] = "PasswordControl";
    /**
     * Displays have audio and video output.
     */
    ScryptedDeviceType["Display"] = "Display";
    /**
     * Smart Displays have two way audio and video.
     */
    ScryptedDeviceType["SmartDisplay"] = "SmartDisplay";
    ScryptedDeviceType["Speaker"] = "Speaker";
    /**
     * Smart Speakers have two way audio.
     */
    ScryptedDeviceType["SmartSpeaker"] = "SmartSpeaker";
    ScryptedDeviceType["RemoteDesktop"] = "RemoteDesktop";
    ScryptedDeviceType["Event"] = "Event";
    ScryptedDeviceType["Entry"] = "Entry";
    ScryptedDeviceType["Garage"] = "Garage";
    ScryptedDeviceType["DeviceProvider"] = "DeviceProvider";
    ScryptedDeviceType["DataSource"] = "DataSource";
    ScryptedDeviceType["API"] = "API";
    ScryptedDeviceType["Buttons"] = "Buttons";
    ScryptedDeviceType["Doorbell"] = "Doorbell";
    ScryptedDeviceType["Irrigation"] = "Irrigation";
    ScryptedDeviceType["Valve"] = "Valve";
    ScryptedDeviceType["Person"] = "Person";
    ScryptedDeviceType["SecuritySystem"] = "SecuritySystem";
    ScryptedDeviceType["WindowCovering"] = "WindowCovering";
    ScryptedDeviceType["Siren"] = "Siren";
    ScryptedDeviceType["AirPurifier"] = "AirPurifier";
    ScryptedDeviceType["Internet"] = "Internet";
    ScryptedDeviceType["Network"] = "Network";
    ScryptedDeviceType["Bridge"] = "Bridge";
    ScryptedDeviceType["LLM"] = "LLM";
    ScryptedDeviceType["Unknown"] = "Unknown";
})(ScryptedDeviceType || (exports.ScryptedDeviceType = ScryptedDeviceType = {}));
var HumidityMode;
(function (HumidityMode) {
    HumidityMode["Humidify"] = "Humidify";
    HumidityMode["Dehumidify"] = "Dehumidify";
    HumidityMode["Auto"] = "Auto";
    HumidityMode["Off"] = "Off";
})(HumidityMode || (exports.HumidityMode = HumidityMode = {}));
var FanMode;
(function (FanMode) {
    FanMode["Auto"] = "Auto";
    FanMode["Manual"] = "Manual";
})(FanMode || (exports.FanMode = FanMode = {}));
var TemperatureUnit;
(function (TemperatureUnit) {
    TemperatureUnit["C"] = "C";
    TemperatureUnit["F"] = "F";
})(TemperatureUnit || (exports.TemperatureUnit = TemperatureUnit = {}));
var ThermostatMode;
(function (ThermostatMode) {
    ThermostatMode["Off"] = "Off";
    ThermostatMode["Cool"] = "Cool";
    ThermostatMode["Heat"] = "Heat";
    ThermostatMode["HeatCool"] = "HeatCool";
    ThermostatMode["Auto"] = "Auto";
    ThermostatMode["FanOnly"] = "FanOnly";
    ThermostatMode["Purifier"] = "Purifier";
    ThermostatMode["Eco"] = "Eco";
    ThermostatMode["Dry"] = "Dry";
    ThermostatMode["On"] = "On";
})(ThermostatMode || (exports.ThermostatMode = ThermostatMode = {}));
var PanTiltZoomMovement;
(function (PanTiltZoomMovement) {
    PanTiltZoomMovement["Absolute"] = "Absolute";
    PanTiltZoomMovement["Relative"] = "Relative";
    PanTiltZoomMovement["Continuous"] = "Continuous";
    PanTiltZoomMovement["Preset"] = "Preset";
    PanTiltZoomMovement["Home"] = "Home";
})(PanTiltZoomMovement || (exports.PanTiltZoomMovement = PanTiltZoomMovement = {}));
var LockState;
(function (LockState) {
    LockState["Locked"] = "Locked";
    LockState["Unlocked"] = "Unlocked";
    LockState["Jammed"] = "Jammed";
})(LockState || (exports.LockState = LockState = {}));
var ChargeState;
(function (ChargeState) {
    ChargeState["Trickle"] = "trickle";
    ChargeState["Charging"] = "charging";
    ChargeState["NotCharging"] = "not-charging";
})(ChargeState || (exports.ChargeState = ChargeState = {}));
var AirPurifierStatus;
(function (AirPurifierStatus) {
    AirPurifierStatus["Inactive"] = "Inactive";
    AirPurifierStatus["Idle"] = "Idle";
    AirPurifierStatus["Active"] = "Active";
    AirPurifierStatus["ActiveNightMode"] = "ActiveNightMode";
})(AirPurifierStatus || (exports.AirPurifierStatus = AirPurifierStatus = {}));
var AirPurifierMode;
(function (AirPurifierMode) {
    AirPurifierMode["Manual"] = "Manual";
    AirPurifierMode["Automatic"] = "Automatic";
})(AirPurifierMode || (exports.AirPurifierMode = AirPurifierMode = {}));
var AirQuality;
(function (AirQuality) {
    AirQuality["Unknown"] = "Unknown";
    AirQuality["Excellent"] = "Excellent";
    AirQuality["Good"] = "Good";
    AirQuality["Fair"] = "Fair";
    AirQuality["Inferior"] = "Inferior";
    AirQuality["Poor"] = "Poor";
})(AirQuality || (exports.AirQuality = AirQuality = {}));
var SecuritySystemMode;
(function (SecuritySystemMode) {
    SecuritySystemMode["Disarmed"] = "Disarmed";
    SecuritySystemMode["HomeArmed"] = "HomeArmed";
    SecuritySystemMode["AwayArmed"] = "AwayArmed";
    SecuritySystemMode["NightArmed"] = "NightArmed";
})(SecuritySystemMode || (exports.SecuritySystemMode = SecuritySystemMode = {}));
var SecuritySystemObstruction;
(function (SecuritySystemObstruction) {
    SecuritySystemObstruction["Sensor"] = "Sensor";
    SecuritySystemObstruction["Occupied"] = "Occupied";
    SecuritySystemObstruction["Time"] = "Time";
    SecuritySystemObstruction["Error"] = "Error";
})(SecuritySystemObstruction || (exports.SecuritySystemObstruction = SecuritySystemObstruction = {}));
var MediaPlayerState;
(function (MediaPlayerState) {
    MediaPlayerState["Idle"] = "Idle";
    MediaPlayerState["Playing"] = "Playing";
    MediaPlayerState["Paused"] = "Paused";
    MediaPlayerState["Buffering"] = "Buffering";
})(MediaPlayerState || (exports.MediaPlayerState = MediaPlayerState = {}));
var ScryptedInterface;
(function (ScryptedInterface) {
    ScryptedInterface["ScryptedDevice"] = "ScryptedDevice";
    ScryptedInterface["ScryptedPlugin"] = "ScryptedPlugin";
    ScryptedInterface["ScryptedPluginRuntime"] = "ScryptedPluginRuntime";
    ScryptedInterface["OnOff"] = "OnOff";
    ScryptedInterface["Brightness"] = "Brightness";
    ScryptedInterface["ColorSettingTemperature"] = "ColorSettingTemperature";
    ScryptedInterface["ColorSettingRgb"] = "ColorSettingRgb";
    ScryptedInterface["ColorSettingHsv"] = "ColorSettingHsv";
    ScryptedInterface["Buttons"] = "Buttons";
    ScryptedInterface["PressButtons"] = "PressButtons";
    ScryptedInterface["Sensors"] = "Sensors";
    ScryptedInterface["Notifier"] = "Notifier";
    ScryptedInterface["StartStop"] = "StartStop";
    ScryptedInterface["Pause"] = "Pause";
    ScryptedInterface["Dock"] = "Dock";
    ScryptedInterface["TemperatureSetting"] = "TemperatureSetting";
    ScryptedInterface["Thermometer"] = "Thermometer";
    ScryptedInterface["HumiditySensor"] = "HumiditySensor";
    ScryptedInterface["Camera"] = "Camera";
    ScryptedInterface["Resolution"] = "Resolution";
    ScryptedInterface["Microphone"] = "Microphone";
    ScryptedInterface["AudioVolumeControl"] = "AudioVolumeControl";
    ScryptedInterface["Display"] = "Display";
    ScryptedInterface["VideoCamera"] = "VideoCamera";
    ScryptedInterface["VideoCameraMask"] = "VideoCameraMask";
    ScryptedInterface["VideoTextOverlays"] = "VideoTextOverlays";
    ScryptedInterface["VideoRecorder"] = "VideoRecorder";
    ScryptedInterface["VideoRecorderManagement"] = "VideoRecorderManagement";
    ScryptedInterface["PanTiltZoom"] = "PanTiltZoom";
    ScryptedInterface["EventRecorder"] = "EventRecorder";
    ScryptedInterface["VideoClips"] = "VideoClips";
    ScryptedInterface["VideoCameraConfiguration"] = "VideoCameraConfiguration";
    ScryptedInterface["Intercom"] = "Intercom";
    ScryptedInterface["Lock"] = "Lock";
    ScryptedInterface["PasswordStore"] = "PasswordStore";
    ScryptedInterface["Scene"] = "Scene";
    ScryptedInterface["Entry"] = "Entry";
    ScryptedInterface["EntrySensor"] = "EntrySensor";
    ScryptedInterface["DeviceProvider"] = "DeviceProvider";
    ScryptedInterface["DeviceDiscovery"] = "DeviceDiscovery";
    ScryptedInterface["DeviceCreator"] = "DeviceCreator";
    ScryptedInterface["Battery"] = "Battery";
    ScryptedInterface["Charger"] = "Charger";
    ScryptedInterface["Reboot"] = "Reboot";
    ScryptedInterface["Refresh"] = "Refresh";
    ScryptedInterface["MediaPlayer"] = "MediaPlayer";
    ScryptedInterface["Online"] = "Online";
    ScryptedInterface["BufferConverter"] = "BufferConverter";
    ScryptedInterface["MediaConverter"] = "MediaConverter";
    ScryptedInterface["Settings"] = "Settings";
    ScryptedInterface["BinarySensor"] = "BinarySensor";
    ScryptedInterface["TamperSensor"] = "TamperSensor";
    ScryptedInterface["Sleep"] = "Sleep";
    ScryptedInterface["PowerSensor"] = "PowerSensor";
    ScryptedInterface["AudioSensor"] = "AudioSensor";
    ScryptedInterface["MotionSensor"] = "MotionSensor";
    ScryptedInterface["AmbientLightSensor"] = "AmbientLightSensor";
    ScryptedInterface["OccupancySensor"] = "OccupancySensor";
    ScryptedInterface["FloodSensor"] = "FloodSensor";
    ScryptedInterface["UltravioletSensor"] = "UltravioletSensor";
    ScryptedInterface["LuminanceSensor"] = "LuminanceSensor";
    ScryptedInterface["PositionSensor"] = "PositionSensor";
    ScryptedInterface["SecuritySystem"] = "SecuritySystem";
    ScryptedInterface["PM10Sensor"] = "PM10Sensor";
    ScryptedInterface["PM25Sensor"] = "PM25Sensor";
    ScryptedInterface["VOCSensor"] = "VOCSensor";
    ScryptedInterface["NOXSensor"] = "NOXSensor";
    ScryptedInterface["CO2Sensor"] = "CO2Sensor";
    ScryptedInterface["AirQualitySensor"] = "AirQualitySensor";
    ScryptedInterface["AirPurifier"] = "AirPurifier";
    ScryptedInterface["FilterMaintenance"] = "FilterMaintenance";
    ScryptedInterface["Readme"] = "Readme";
    ScryptedInterface["OauthClient"] = "OauthClient";
    ScryptedInterface["MixinProvider"] = "MixinProvider";
    ScryptedInterface["HttpRequestHandler"] = "HttpRequestHandler";
    ScryptedInterface["EngineIOHandler"] = "EngineIOHandler";
    ScryptedInterface["PushHandler"] = "PushHandler";
    ScryptedInterface["Program"] = "Program";
    ScryptedInterface["Scriptable"] = "Scriptable";
    ScryptedInterface["ClusterForkInterface"] = "ClusterForkInterface";
    ScryptedInterface["ObjectDetector"] = "ObjectDetector";
    ScryptedInterface["ObjectDetection"] = "ObjectDetection";
    ScryptedInterface["ObjectDetectionPreview"] = "ObjectDetectionPreview";
    ScryptedInterface["ObjectDetectionGenerator"] = "ObjectDetectionGenerator";
    ScryptedInterface["HumiditySetting"] = "HumiditySetting";
    ScryptedInterface["Fan"] = "Fan";
    ScryptedInterface["RTCSignalingChannel"] = "RTCSignalingChannel";
    ScryptedInterface["RTCSignalingClient"] = "RTCSignalingClient";
    ScryptedInterface["LauncherApplication"] = "LauncherApplication";
    ScryptedInterface["ScryptedUser"] = "ScryptedUser";
    ScryptedInterface["VideoFrameGenerator"] = "VideoFrameGenerator";
    ScryptedInterface["StreamService"] = "StreamService";
    ScryptedInterface["TTY"] = "TTY";
    ScryptedInterface["TTYSettings"] = "TTYSettings";
    ScryptedInterface["ChatCompletion"] = "ChatCompletion";
    ScryptedInterface["TextEmbedding"] = "TextEmbedding";
    ScryptedInterface["ImageEmbedding"] = "ImageEmbedding";
    ScryptedInterface["LLMTools"] = "LLMTools";
    ScryptedInterface["ScryptedSystemDevice"] = "ScryptedSystemDevice";
    ScryptedInterface["ScryptedDeviceCreator"] = "ScryptedDeviceCreator";
    ScryptedInterface["ScryptedSettings"] = "ScryptedSettings";
})(ScryptedInterface || (exports.ScryptedInterface = ScryptedInterface = {}));
var ScryptedMimeTypes;
(function (ScryptedMimeTypes) {
    ScryptedMimeTypes["Url"] = "text/x-uri";
    ScryptedMimeTypes["InsecureLocalUrl"] = "text/x-insecure-local-uri";
    ScryptedMimeTypes["LocalUrl"] = "text/x-local-uri";
    ScryptedMimeTypes["ServerId"] = "text/x-server-id";
    ScryptedMimeTypes["PushEndpoint"] = "text/x-push-endpoint";
    ScryptedMimeTypes["SchemePrefix"] = "x-scrypted/x-scrypted-scheme-";
    ScryptedMimeTypes["MediaStreamUrl"] = "text/x-media-url";
    ScryptedMimeTypes["MediaObject"] = "x-scrypted/x-scrypted-media-object";
    ScryptedMimeTypes["RequestMediaObject"] = "x-scrypted/x-scrypted-request-media-object";
    ScryptedMimeTypes["RequestMediaStream"] = "x-scrypted/x-scrypted-request-stream";
    ScryptedMimeTypes["MediaStreamFeedback"] = "x-scrypted/x-media-stream-feedback";
    ScryptedMimeTypes["FFmpegInput"] = "x-scrypted/x-ffmpeg-input";
    ScryptedMimeTypes["FFmpegTranscodeStream"] = "x-scrypted/x-ffmpeg-transcode-stream";
    ScryptedMimeTypes["RTCSignalingChannel"] = "x-scrypted/x-scrypted-rtc-signaling-channel";
    ScryptedMimeTypes["RTCSignalingSession"] = "x-scrypted/x-scrypted-rtc-signaling-session";
    ScryptedMimeTypes["RTCConnectionManagement"] = "x-scrypted/x-scrypted-rtc-connection-management";
    ScryptedMimeTypes["Image"] = "x-scrypted/x-scrypted-image";
})(ScryptedMimeTypes || (exports.ScryptedMimeTypes = ScryptedMimeTypes = {}));
//# sourceMappingURL=index.js.map

/***/ },

/***/ "./src/main.ts"
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const sdk_1 = __importStar(__webpack_require__(/*! @scrypted/sdk */ "./node_modules/@scrypted/sdk/dist/src/index.js"));
function generateHex(bytes) {
    try {
        return (__webpack_require__(/*! crypto */ "crypto").randomBytes)(bytes).toString('hex');
    }
    catch {
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
class ScrixPlugin extends sdk_1.ScryptedDeviceBase {
    constructor(nativeId) {
        super(nativeId);
        if (!this.storage.getItem('apiKey')) {
            const key = generateHex(32);
            this.storage.setItem('apiKey', key);
            this.console.log('Generated new API key. Copy it from plugin settings into Scrix.');
        }
    }
    // --- Settings ---
    async getSettings() {
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
    async putSetting(key, value) {
        if (key === 'regenerateKey') {
            const newKey = generateHex(32);
            this.storage.setItem('apiKey', newKey);
            this.console.log('API key regenerated.');
        }
    }
    // --- Auth middleware ---
    authenticate(request) {
        const headers = request.headers || {};
        const auth = headers.authorization || headers.Authorization;
        if (!auth)
            return false;
        const token = auth.replace('Bearer ', '');
        return token === this.storage.getItem('apiKey');
    }
    // --- Status endpoint ---
    async handleStatus(response) {
        const plugins = await sdk_1.default.systemManager.getComponent('plugins');
        const devices = sdk_1.default.systemManager.getSystemState();
        let nvrInstalled = false;
        const detectionPlugins = [];
        const detectionTypes = new Set();
        for (const [id, device] of Object.entries(devices)) {
            const interfaces = device.interfaces?.value;
            if (!interfaces)
                continue;
            if (interfaces.includes(sdk_1.ScryptedInterface.ObjectDetection)) {
                const pluginId = device.pluginId?.value;
                if (pluginId && !detectionPlugins.includes(pluginId)) {
                    detectionPlugins.push(pluginId);
                }
            }
        }
        try {
            const installedPlugins = await plugins.getInstalledPlugins();
            nvrInstalled = installedPlugins.includes('@scrypted/nvr');
        }
        catch {
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
    getManagedCameras() {
        const raw = this.storage.getItem('managedCameras');
        if (!raw)
            return [];
        try {
            return JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    saveManagedCameras(cameras) {
        this.storage.setItem('managedCameras', JSON.stringify(cameras));
    }
    addManagedCamera(camera) {
        const cameras = this.getManagedCameras();
        cameras.push(camera);
        this.saveManagedCameras(cameras);
    }
    removeManagedCamera(nativeId) {
        const cameras = this.getManagedCameras().filter(c => c.nativeId !== nativeId);
        this.saveManagedCameras(cameras);
    }
    findCameraByIp(ip) {
        return this.getManagedCameras().find(c => c.ip === ip);
    }
    // --- Camera creation endpoint ---
    async handleCreateCamera(request, response) {
        let body;
        try {
            body = JSON.parse(request.body || '{}');
        }
        catch {
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
                await sdk_1.default.deviceManager.onDeviceRemoved(existing.nativeId);
                this.removeManagedCamera(existing.nativeId);
                this.console.log(`Removed existing camera at IP ${body.ip} (force replace).`);
            }
            catch (e) {
                this.console.error(`Failed to remove existing camera: ${e}`);
            }
        }
        // Generate nativeId: scrix-{ip_with_underscores} with crypto fallback
        let nativeId = `scrix-${body.ip.replace(/\./g, '_')}`;
        // Check if this nativeId is already in use by another camera
        const allNativeIds = sdk_1.default.deviceManager.getNativeIds();
        if (allNativeIds.includes(nativeId)) {
            nativeId = `scrix-${body.ip.replace(/\./g, '_')}-${generateHex(4)}`;
        }
        // Create the RTSP camera device in Scrypted
        const scryptedId = await sdk_1.default.deviceManager.onDeviceDiscovered({
            name: body.name,
            nativeId,
            type: sdk_1.ScryptedDeviceType.Camera,
            interfaces: [
                sdk_1.ScryptedInterface.VideoCamera,
                sdk_1.ScryptedInterface.Settings,
            ],
            info: {
                manufacturer: 'Scrix',
                ip: body.ip,
            },
        });
        // Store RTSP stream URLs in the device's storage
        const deviceStorage = sdk_1.default.deviceManager.getDeviceStorage(nativeId);
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
        const managedCamera = {
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
                    const device = sdk_1.default.systemManager.getDeviceById(scryptedId);
                    if (!device)
                        return;
                    // Get current mixins
                    const state = sdk_1.default.systemManager.getSystemState();
                    const deviceState = state[scryptedId];
                    const currentMixins = deviceState?.mixins?.value;
                    if (!currentMixins || currentMixins.length === 0)
                        return;
                    // Build list of plugin IDs to exclude
                    const excludeIds = [];
                    if (!enableNvr)
                        excludeIds.push(nvrPluginId);
                    if (!enableDetection)
                        excludeIds.push(...detectionPluginIds);
                    // Filter out mixin devices that belong to excluded plugins
                    const filteredMixins = currentMixins.filter(mixinId => {
                        const mixinDevice = sdk_1.default.systemManager.getDeviceById(mixinId);
                        if (!mixinDevice)
                            return true;
                        const mixinState = state[mixinId];
                        const pluginId = mixinState?.pluginId?.value;
                        return !pluginId || !excludeIds.includes(pluginId);
                    });
                    if (filteredMixins.length !== currentMixins.length) {
                        await device.setMixins(filteredMixins);
                        this.console.log(`Mixin opt-out applied for camera "${body.name}".`);
                    }
                }
                catch (e) {
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
    async handleDeleteCamera(request, response) {
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
            await sdk_1.default.deviceManager.onDeviceRemoved(camera.nativeId);
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
        }
        catch (e) {
            response.send(JSON.stringify({
                error: `Failed to delete camera: ${e}`,
            }), {
                code: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }
    // --- HTTP handler ---
    async onRequest(request, response) {
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
    async getDevice(nativeId) {
        return new sdk_1.ScryptedDeviceBase(nativeId);
    }
    async releaseDevice(id, nativeId) { }
}
exports["default"] = ScrixPlugin;


/***/ },

/***/ "crypto"
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
(module) {

"use strict";
module.exports = require("crypto");

/***/ },

/***/ "fs"
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
(module) {

"use strict";
module.exports = require("fs");

/***/ },

/***/ "module"
/*!*************************!*\
  !*** external "module" ***!
  \*************************/
(module) {

"use strict";
module.exports = require("module");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main.ts");
/******/ 	var __webpack_export_target__ = (exports = typeof exports === "undefined" ? {} : exports);
/******/ 	for(var __webpack_i__ in __webpack_exports__) __webpack_export_target__[__webpack_i__] = __webpack_exports__[__webpack_i__];
/******/ 	if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ 	
/******/ })()
;

//# sourceURL=/plugin/main.nodejs.js
//# sourceMappingURL=main.nodejs.js.map