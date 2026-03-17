package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/MrBunbao/scrix/internal/scrypted"
)

// ScryptedHandler handles Scrypted proxy and settings requests.
type ScryptedHandler struct {
	logger interface {
		Debug(string, ...any)
		Error(string, error, ...any)
		Info(string, ...any)
	}
}

// NewScryptedHandler creates a new Scrypted handler.
func NewScryptedHandler(
	logger interface {
		Debug(string, ...any)
		Error(string, error, ...any)
		Info(string, ...any)
	},
) *ScryptedHandler {
	return &ScryptedHandler{logger: logger}
}

// Status proxies GET /api/status to the Scrypted plugin.
func (h *ScryptedHandler) Status(w http.ResponseWriter, r *http.Request) {
	client, err := h.newClient()
	if err != nil {
		h.writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	status, body, err := client.GetStatus()
	if err != nil {
		h.logger.Error("scrypted status request failed", err)
		h.writeError(w, "Failed to reach Scrypted: "+err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}

// AddCamera proxies POST /api/cameras to the Scrypted plugin.
func (h *ScryptedHandler) AddCamera(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		h.writeError(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	client, err := h.newClient()
	if err != nil {
		h.writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	force := r.URL.Query().Get("force") == "true"

	var status int
	var body []byte
	if force {
		status, body, err = client.AddCameraForce(payload)
	} else {
		status, body, err = client.AddCamera(payload)
	}
	if err != nil {
		h.logger.Error("scrypted add camera request failed", err)
		h.writeError(w, "Failed to reach Scrypted: "+err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}

// DeleteCamera proxies DELETE /api/cameras to the Scrypted plugin.
func (h *ScryptedHandler) DeleteCamera(w http.ResponseWriter, r *http.Request) {
	nativeId := r.URL.Query().Get("id")
	if nativeId == "" {
		h.writeError(w, "Missing required parameter: id", http.StatusBadRequest)
		return
	}

	client, err := h.newClient()
	if err != nil {
		h.writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	status, body, err := client.DeleteCamera(nativeId)
	if err != nil {
		h.logger.Error("scrypted delete camera request failed", err)
		h.writeError(w, "Failed to reach Scrypted: "+err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}

// SettingsResponse is the public representation of Scrypted settings.
type SettingsResponse struct {
	Host      string `json:"host"`
	HasAPIKey bool   `json:"hasApiKey"`
	TLSVerify bool   `json:"tlsVerify"`
}

// GetSettings returns the current Scrypted connection settings.
func (h *ScryptedHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	cfg, err := scrypted.LoadConfig()
	if err != nil {
		h.logger.Error("failed to load scrypted config", err)
		h.writeError(w, "Failed to load config", http.StatusInternalServerError)
		return
	}

	resp := SettingsResponse{
		Host:      cfg.Scrypted.Host,
		HasAPIKey: cfg.Scrypted.APIKey != "",
		TLSVerify: cfg.Scrypted.TLSVerify,
	}

	h.writeJSON(w, http.StatusOK, resp)
}

// SaveSettingsRequest is the request body for saving Scrypted settings.
type SaveSettingsRequest struct {
	Host      string `json:"host"`
	APIKey    string `json:"apiKey"`
	TLSVerify bool   `json:"tlsVerify"`
}

// SaveSettings saves the Scrypted connection settings.
func (h *ScryptedHandler) SaveSettings(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var req SaveSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	cfg := &scrypted.Config{
		Scrypted: scrypted.ScryptedConfig{
			Host:      req.Host,
			APIKey:    req.APIKey,
			TLSVerify: req.TLSVerify,
		},
	}

	if err := scrypted.SaveConfig(cfg); err != nil {
		h.logger.Error("failed to save scrypted config", err)
		h.writeError(w, "Failed to save config", http.StatusInternalServerError)
		return
	}

	h.logger.Info("scrypted settings saved", "host", req.Host, "tls_verify", req.TLSVerify)
	h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// newClient loads the config and creates a Scrypted client.
func (h *ScryptedHandler) newClient() (*scrypted.Client, error) {
	cfg, err := scrypted.LoadConfig()
	if err != nil {
		h.logger.Error("failed to load scrypted config", err)
		return nil, err
	}
	return scrypted.NewClient(&cfg.Scrypted), nil
}

// writeJSON writes a JSON response.
func (h *ScryptedHandler) writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		h.logger.Error("failed to encode JSON response", err)
	}
}

// writeError writes a JSON error response.
func (h *ScryptedHandler) writeError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	resp := map[string]interface{}{
		"error":   true,
		"message": message,
		"code":    statusCode,
	}
	_ = json.NewEncoder(w).Encode(resp)
}
