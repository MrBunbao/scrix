/**
 * "Add to Scrypted" panel.
 * Displays stream summary and provides controls to add the camera to Scrypted NVR.
 * Uses safe DOM construction (textContent for user data, createElement for structure).
 */
export class ScryptedPanel {
    constructor(container) {
        this.container = container;
        this.mainStream = null;
        this.subStream = null;
        this.nvrInstalled = false;
        this.availableDetectionTypes = [];
        this.statusArea = null;
        this.loadStatus();
    }

    async loadStatus() {
        try {
            const resp = await fetch('/api/v1/scrypted/status');
            if (resp.ok) {
                const data = await resp.json();
                this.nvrInstalled = !!data.nvrInstalled;
                this.availableDetectionTypes = data.availableDetectionTypes || [];
            }
        } catch (err) {
            // Scrypted not configured - panel will still render
        }
    }

    setStreams(mainStream, subStream) {
        this.mainStream = mainStream;
        this.subStream = subStream;
        this.render();
    }

    render() {
        this.container.replaceChildren();

        if (!this.mainStream) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'scrypted-panel';

        // Section title
        const title = document.createElement('h3');
        title.className = 'section-title';
        title.textContent = 'Add to Scrypted';
        wrapper.appendChild(title);

        // Stream summary
        wrapper.appendChild(this.renderStreamSummary());

        // Camera name input
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';

        const nameLabel = document.createElement('label');
        nameLabel.className = 'label';
        nameLabel.textContent = 'Camera Name';
        nameLabel.setAttribute('for', 'scrypted-camera-name');
        nameGroup.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'scrypted-camera-name';
        nameInput.className = 'input';
        nameInput.value = this.generateCameraName();
        nameInput.autocomplete = 'off';
        nameInput.spellcheck = false;
        nameGroup.appendChild(nameInput);
        this.nameInput = nameInput;

        wrapper.appendChild(nameGroup);

        // NVR checkbox (only if NVR is installed)
        if (this.nvrInstalled) {
            const nvrCheck = this.createCheckbox(
                'scrypted-enable-nvr',
                'Enable NVR recording',
                true
            );
            this.nvrCheckbox = nvrCheck.querySelector('input');
            wrapper.appendChild(nvrCheck);
        }

        // Detection checkboxes (only if detection types available)
        if (this.availableDetectionTypes.length > 0) {
            const detectCheck = this.createCheckbox(
                'scrypted-enable-detection',
                'Enable object detection',
                true
            );
            this.detectCheckbox = detectCheck.querySelector('input');
            wrapper.appendChild(detectCheck);

            // Individual detection type checkboxes
            const typesWrapper = document.createElement('div');
            typesWrapper.className = 'scrypted-detection-types';
            this.detectionTypeCheckboxes = [];

            this.availableDetectionTypes.forEach((dtype) => {
                const typeCheck = this.createCheckbox(
                    'scrypted-detect-' + dtype,
                    dtype,
                    true
                );
                typeCheck.className = 'checkbox-group checkbox-indent';
                const cb = typeCheck.querySelector('input');
                this.detectionTypeCheckboxes.push({ type: dtype, checkbox: cb });
                typesWrapper.appendChild(typeCheck);
            });

            wrapper.appendChild(typesWrapper);

            // Toggle detection types when master checkbox changes
            this.detectCheckbox.addEventListener('change', () => {
                const enabled = this.detectCheckbox.checked;
                this.detectionTypeCheckboxes.forEach(({ checkbox }) => {
                    checkbox.disabled = !enabled;
                });
            });
        }

        // Add to Scrypted button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary btn-large';
        addBtn.textContent = 'Add to Scrypted';
        addBtn.style.marginTop = 'var(--space-6)';
        addBtn.addEventListener('click', () => this.addCamera(false));
        wrapper.appendChild(addBtn);

        // Status message area
        this.statusArea = document.createElement('div');
        this.statusArea.className = 'status-message hidden';
        wrapper.appendChild(this.statusArea);

        this.container.appendChild(wrapper);
    }

    renderStreamSummary() {
        const summary = document.createElement('div');
        summary.className = 'scrypted-stream-summary';

        // Main stream
        const mainCard = this.renderStreamCard('Main Stream', this.mainStream);
        summary.appendChild(mainCard);

        // Sub stream (if present)
        if (this.subStream) {
            const subCard = this.renderStreamCard('Sub Stream', this.subStream);
            summary.appendChild(subCard);
        }

        return summary;
    }

    renderStreamCard(label, stream) {
        const card = document.createElement('div');
        card.className = 'scrypted-stream-card';

        const labelEl = document.createElement('div');
        labelEl.className = 'stream-label';
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        labelEl.appendChild(labelSpan);
        card.appendChild(labelEl);

        // URL (masked)
        const urlEl = document.createElement('div');
        urlEl.className = 'selected-url';
        urlEl.textContent = this.maskCredentials(stream.url);
        card.appendChild(urlEl);

        // Meta line (resolution, codec)
        const meta = document.createElement('div');
        meta.className = 'scrypted-stream-meta';
        const parts = [];
        if (stream.resolution) parts.push(stream.resolution);
        if (stream.codec) parts.push(stream.codec);
        if (stream.fps) parts.push(stream.fps + ' fps');
        meta.textContent = parts.join(' / ');
        card.appendChild(meta);

        return card;
    }

    createCheckbox(id, labelText, checked) {
        const group = document.createElement('div');
        group.className = 'checkbox-group';

        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.setAttribute('for', id);

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = checked;
        label.appendChild(input);

        const span = document.createElement('span');
        span.textContent = labelText;
        label.appendChild(span);

        group.appendChild(label);
        return group;
    }

    async addCamera(force) {
        if (!this.mainStream) {
            this.showStatus('No stream selected.', 'error');
            return;
        }

        const name = this.nameInput.value.trim();
        if (!name) {
            this.showStatus('Please enter a camera name.', 'error');
            return;
        }

        const payload = {
            name: name,
            mainStreamUrl: this.mainStream.url,
        };

        if (this.subStream) {
            payload.subStreamUrl = this.subStream.url;
        }

        if (this.nvrCheckbox) {
            payload.enableNvr = this.nvrCheckbox.checked;
        }

        if (this.detectCheckbox && this.detectCheckbox.checked) {
            const selectedTypes = [];
            this.detectionTypeCheckboxes.forEach(({ type, checkbox }) => {
                if (checkbox.checked) {
                    selectedTypes.push(type);
                }
            });
            if (selectedTypes.length > 0) {
                payload.detectionTypes = selectedTypes;
            }
        }

        this.showStatus('Adding camera to Scrypted...', 'info');

        try {
            const url = '/api/v1/scrypted/add' + (force ? '?force=true' : '');
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (resp.status === 201) {
                const data = await resp.json();
                let msg = 'Camera added to Scrypted.';
                if (data.nativeId) {
                    msg += ' ID: ' + data.nativeId;
                }
                this.showStatus(msg, 'success');
            } else if (resp.status === 409) {
                const data = await resp.json().catch(() => ({}));
                this.showDuplicateWarning(data);
            } else {
                const data = await resp.json().catch(() => ({}));
                this.showStatus(data.message || 'Failed to add camera (' + resp.status + ').', 'error');
            }
        } catch (err) {
            this.showStatus('Network error. Is the server running?', 'error');
        }
    }

    showDuplicateWarning(data) {
        // Clear status area and build warning with button
        this.statusArea.replaceChildren();
        this.statusArea.className = 'status-message status-warning';

        const msg = document.createElement('span');
        msg.textContent = data.message || 'A camera with this URL already exists in Scrypted.';
        this.statusArea.appendChild(msg);

        const forceBtn = document.createElement('button');
        forceBtn.className = 'btn btn-outline btn-small';
        forceBtn.textContent = 'Add Anyway';
        forceBtn.style.marginLeft = 'var(--space-3)';
        forceBtn.addEventListener('click', () => this.addCamera(true));
        this.statusArea.appendChild(forceBtn);
    }

    extractIp(url) {
        const match = url.match(/@([^:/]+)/);
        return match ? match[1] : null;
    }

    generateCameraName() {
        if (!this.mainStream) return 'Camera';
        const ip = this.extractIp(this.mainStream.url);
        if (ip) {
            return 'Camera ' + ip.replace(/\./g, '_');
        }
        return 'Camera';
    }

    maskCredentials(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.username || urlObj.password) {
                urlObj.username = urlObj.username ? '***' : '';
                urlObj.password = urlObj.password ? '***' : '';
            }
            return urlObj.toString();
        } catch (e) {
            return url;
        }
    }

    showStatus(message, type) {
        this.statusArea.textContent = message;
        this.statusArea.className = 'status-message status-' + type;
    }
}
