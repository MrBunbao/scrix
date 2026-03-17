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
