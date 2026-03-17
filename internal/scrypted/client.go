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
	return fmt.Sprintf("%s/endpoint/scrypted-scrix/public%s", c.baseURL, path)
}

func (c *Client) do(method, path string, body []byte) (int, []byte, error) {
	reqURL := c.pluginURL(path)
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, reqURL, bodyReader)
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
