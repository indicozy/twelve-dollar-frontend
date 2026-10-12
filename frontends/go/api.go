package main

// API client: one shared http.Client (keep-alive pool) for every handler. No caching: every call hits the API.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Post struct {
	ID        int64  `json:"id"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
	Author    string `json:"author"`
	LikeCount int64  `json:"like_count"`
}

// Date is the post's created_at as Intl.DateTimeFormat("en", {dateStyle:"medium", timeStyle:"short",
// timeZone:"UTC"}) + " UTC" prints it, e.g. "Dec 31, 2025, 11:59 PM UTC".
func (p Post) Date() string {
	t, err := time.Parse(time.RFC3339Nano, p.CreatedAt)
	if err != nil {
		return p.CreatedAt // never happens with the API's data; show the raw value rather than failing the page
	}
	return t.UTC().Format("Jan 2, 2006, 3:04 PM") + " UTC"
}

type API struct {
	base   string
	client *http.Client
}

func newAPI(base string) *API {
	// http.DefaultTransport keeps only 2 idle connections per host (MaxIdleConnsPerHost), so under load most API
	// calls would open a new TCP connection and close it afterwards. All traffic goes to one host here, so the idle
	// pool is raised to match the other variants' pooled keep-alive clients. No request timeout, like the JS fetch.
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.MaxIdleConns = 512
	t.MaxIdleConnsPerHost = 512
	t.IdleConnTimeout = 90 * time.Second
	t.DialContext = (&net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}).DialContext
	return &API{base: strings.TrimRight(base, "/"), client: &http.Client{Transport: t}}
}

func (a *API) do(method, path, authorization string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, a.base+path, body)
	if err != nil {
		return nil, err
	}
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return a.client.Do(req)
}

// drain reads the rest of the body so the connection goes back to the pool, then closes it.
func drain(res *http.Response) {
	io.Copy(io.Discard, res.Body)
	res.Body.Close()
}

func (a *API) Feed() ([]Post, error) {
	res, err := a.do("GET", "/feed", "", nil)
	if err != nil {
		return nil, err
	}
	defer drain(res)
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("feed: backend returned %d", res.StatusCode)
	}
	var data struct {
		Posts []Post `json:"posts"`
	}
	if err := json.NewDecoder(res.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("feed: %w", err)
	}
	return data.Posts, nil
}

// Post returns nil (no error) when the API answers 404 or 400 (missing or invalid id).
func (a *API) Post(id string) (*Post, error) {
	res, err := a.do("GET", "/posts/"+url.PathEscape(id), "", nil)
	if err != nil {
		return nil, err
	}
	defer drain(res)
	if res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusBadRequest {
		return nil, nil
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("post: backend returned %d", res.StatusCode)
	}
	var data struct {
		Post Post `json:"post"`
	}
	if err := json.NewDecoder(res.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("post: %w", err)
	}
	return &data.Post, nil
}

// CreatePost and LikePost return the raw response; callers read it as JSON or pass the bytes through.
func (a *API) CreatePost(authorization, body string) (*http.Response, error) {
	payload, _ := json.Marshal(struct {
		Body string `json:"body"`
	}{body})
	return a.do("POST", "/posts", authorization, bytes.NewReader(payload))
}

func (a *API) LikePost(authorization, id string) (*http.Response, error) {
	return a.do("POST", "/posts/"+url.PathEscape(id)+"/like", authorization, nil)
}
