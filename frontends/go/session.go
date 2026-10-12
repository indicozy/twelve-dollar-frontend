package main

// Demo session: same HS256 token as frontends/express/lib/session.js (the API has no login endpoint).

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const tokenCookie = "token"

var b64 = base64.RawURLEncoding

// jsonCompact is JSON.stringify: no HTML escaping of < > &, no trailing newline.
func jsonCompact(v any) []byte {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.Encode(v)
	return bytes.TrimSuffix(buf.Bytes(), []byte("\n"))
}

var jwtHead = b64.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

func signToken(secret []byte, userID int64, username string) string {
	now := time.Now().Unix()
	body := b64.EncodeToString(jsonCompact(struct {
		Sub      string `json:"sub"`
		Username string `json:"username"`
		Iat      int64  `json:"iat"`
		Exp      int64  `json:"exp"`
	}{strconv.FormatInt(userID, 10), username, now, now + 7*86400}))
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(jwtHead + "." + body))
	return jwtHead + "." + body + "." + b64.EncodeToString(mac.Sum(nil))
}

func currentToken(r *http.Request) string {
	c, err := r.Cookie(tokenCookie)
	if err != nil {
		return ""
	}
	return c.Value
}

// currentUsername reads the token cookie's payload on every request (not verified, like the JS variants).
func currentUsername(token string) string {
	if token == "" {
		return ""
	}
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return ""
	}
	raw, err := b64.DecodeString(strings.TrimRight(parts[1], "="))
	if err != nil {
		return ""
	}
	var p struct {
		Username string `json:"username"`
	}
	if json.Unmarshal(raw, &p) != nil {
		return ""
	}
	return p.Username
}
