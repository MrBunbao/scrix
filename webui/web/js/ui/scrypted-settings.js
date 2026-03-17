/**
 * Scrypted Settings panel.
 * Provides form for configuring Scrypted host, API key, and connection testing.
 * Uses safe DOM construction (no innerHTML with user data).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function createEyeIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon-eye');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'none');

    const circle1 = document.createElementNS(SVG_NS, 'circle');
    circle1.setAttribute('cx', '10');
    circle1.setAttribute('cy', '10');
    circle1.setAttribute('r', '3');
    circle1.setAttribute('stroke', 'currentColor');
    circle1.setAttribute('stroke-width', '1.5');
    svg.appendChild(circle1);

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M2 10c1.5-4 4-6.5 8-6.5s6.5 2.5 8 6.5c-1.5 4-4 6.5-8 6.5S3.5 14 2 10z');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    svg.appendChild(path);

    const circle2 = document.createElementNS(SVG_NS, 'circle');
    circle2.setAttribute('cx', '10');
    circle2.setAttribute('cy', '10');
    circle2.setAttribute('r', '1.5');
    circle2.setAttribute('fill', 'currentColor');
    svg.appendChild(circle2);

    return svg;
}

export class ScryptedSettings {
    constructor(container) {
        this.container = container;
        this.hostInput = null;
        this.apiKeyInput = null;
        this.statusArea = null;
        this.render();
        this.loadSettings();
    }

    render() {
        // Clear container safely
        this.container.replaceChildren();

        const wrapper = document.createElement('div');
        wrapper.className = 'scrypted-settings';

        // Title
        const title = document.createElement('h2');
        title.className = 'screen-title';
        title.textContent = 'Scrypted Settings';
        wrapper.appendChild(title);

        // Host URL
        const hostGroup = this.createFormGroup(
            'Scrypted Host URL',
            'text',
            'https://10.10.10.10:10443',
            'scrypted-host'
        );
        this.hostInput = hostGroup.querySelector('input');
        wrapper.appendChild(hostGroup);

        // API Key
        const apiKeyGroup = this.createFormGroup(
            'API Key',
            'password',
            'Copy from Scrypted plugin settings',
            'scrypted-api-key'
        );
        this.apiKeyInput = apiKeyGroup.querySelector('input');

        // Wrap input in password wrapper with toggle button
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-password-wrapper';
        const existingInput = apiKeyGroup.querySelector('input');
        existingInput.parentElement.replaceChild(inputWrapper, existingInput);
        inputWrapper.appendChild(existingInput);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn-toggle-password';
        toggleBtn.setAttribute('aria-label', 'Toggle API key visibility');
        toggleBtn.appendChild(createEyeIcon());
        toggleBtn.addEventListener('click', () => {
            this.apiKeyInput.type = this.apiKeyInput.type === 'password' ? 'text' : 'password';
        });
        inputWrapper.appendChild(toggleBtn);

        wrapper.appendChild(apiKeyGroup);

        // Buttons row
        const actions = document.createElement('div');
        actions.className = 'scrypted-settings-actions';

        const testBtn = document.createElement('button');
        testBtn.className = 'btn btn-secondary';
        testBtn.textContent = 'Test Connection';
        testBtn.addEventListener('click', () => this.testConnection());
        actions.appendChild(testBtn);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = 'Save Settings';
        saveBtn.addEventListener('click', () => this.saveSettings());
        actions.appendChild(saveBtn);

        wrapper.appendChild(actions);

        // Status message area
        this.statusArea = document.createElement('div');
        this.statusArea.className = 'status-message hidden';
        wrapper.appendChild(this.statusArea);

        this.container.appendChild(wrapper);
    }

    createFormGroup(labelText, inputType, placeholder, inputId) {
        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.className = 'label';
        label.textContent = labelText;
        label.setAttribute('for', inputId);
        group.appendChild(label);

        const input = document.createElement('input');
        input.type = inputType;
        input.id = inputId;
        input.className = 'input';
        input.placeholder = placeholder;
        input.autocomplete = 'off';
        input.spellcheck = false;
        group.appendChild(input);

        return group;
    }

    async loadSettings() {
        try {
            const resp = await fetch('/api/v1/scrypted/settings');
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.host) {
                this.hostInput.value = data.host;
            }
            if (data.hasApiKey) {
                this.apiKeyInput.placeholder = 'API key saved (enter new value to change)';
            }
        } catch (err) {
            // Settings not configured yet - that is fine
        }
    }

    async saveSettings() {
        const host = this.hostInput.value.trim();
        if (!host) {
            this.showStatus('Please enter the Scrypted host URL.', 'error');
            return;
        }

        const payload = { host };
        const apiKey = this.apiKeyInput.value.trim();
        if (apiKey) {
            payload.apiKey = apiKey;
        }

        try {
            this.showStatus('Saving...', 'info');
            const resp = await fetch('/api/v1/scrypted/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (resp.ok) {
                this.apiKeyInput.value = '';
                this.apiKeyInput.placeholder = 'API key saved (enter new value to change)';
                this.showStatus('Settings saved.', 'success');
            } else {
                const data = await resp.json().catch(() => ({}));
                this.showStatus(data.message || 'Failed to save settings.', 'error');
            }
        } catch (err) {
            this.showStatus('Network error. Is the server running?', 'error');
        }
    }

    async testConnection() {
        this.showStatus('Testing connection...', 'info');

        try {
            const resp = await fetch('/api/v1/scrypted/status');

            if (resp.ok) {
                const data = await resp.json();
                let msg = 'Connected to Scrypted.';
                if (data.nvrInstalled) {
                    msg += ' NVR installed.';
                }
                if (data.pluginVersion) {
                    msg += ' Plugin v' + data.pluginVersion + '.';
                }
                this.showStatus(msg, 'success');
            } else if (resp.status === 401) {
                this.showStatus('API key rejected. Check plugin settings.', 'error');
            } else if (resp.status === 404) {
                this.showStatus('Install the scrypted-scrix plugin first.', 'warning');
            } else if (resp.status === 502) {
                this.showStatus('Cannot connect to Scrypted. Check host URL and ensure Scrypted is running.', 'error');
            } else {
                const data = await resp.json().catch(() => ({}));
                this.showStatus(data.message || 'Unexpected error (' + resp.status + ').', 'error');
            }
        } catch (err) {
            this.showStatus('Cannot connect to Scrypted. Check settings.', 'error');
        }
    }

    showStatus(message, type) {
        this.statusArea.textContent = message;
        this.statusArea.className = 'status-message status-' + type;
    }
}
