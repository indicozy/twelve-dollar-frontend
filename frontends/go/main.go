// Go standard-library variant of the SSR feed app (see ../SPEC.md): net/http (Go 1.22+ ServeMux patterns) and
// html/template. Every page is rendered on every request from a fresh API call; nothing is cached. One process.
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"html/template"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

//go:embed templates/*.html
var templateFS embed.FS

//go:embed static/styles.css
var stylesCSS []byte

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

// ---------------------------------------------------------------------------------------------------------------
// Templates: parsed once at startup. Each page is its own template set: layout + post card + the page's "content".
// ---------------------------------------------------------------------------------------------------------------

type cardData struct {
	Post Post
	Link bool
}

type pageData struct {
	Username string
	Posts    []Post
	Post     *Post
	Error    string
}

func parsePages() map[string]*template.Template {
	base := template.Must(template.New("").Funcs(template.FuncMap{
		"card": func(p Post, link bool) cardData { return cardData{p, link} },
	}).ParseFS(templateFS, "templates/layout.html", "templates/post_card.html"))
	pages := map[string]*template.Template{}
	for _, name := range []string{"index", "post", "login", "not_found"} {
		pages[name] = template.Must(template.Must(base.Clone()).ParseFS(templateFS, "templates/"+name+".html"))
	}
	return pages
}

type app struct {
	api    *API
	secret []byte
	pages  map[string]*template.Template
}

// Render buffers are reused across requests (the whole page is rendered before anything is sent, so a missing
// post is a real 404 and the response has a Content-Length).
var bufPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}

func (a *app) render(w http.ResponseWriter, r *http.Request, status int, page string, data pageData) {
	data.Username = currentUsername(currentToken(r))
	buf := bufPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer bufPool.Put(buf)
	if err := a.pages[page].ExecuteTemplate(buf, "layout", data); err != nil {
		serverError(w, err)
		return
	}
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Content-Length", strconv.Itoa(buf.Len()))
	w.WriteHeader(status)
	w.Write(buf.Bytes())
}

func serverError(w http.ResponseWriter, err error) {
	log.Print(err)
	http.Error(w, "Internal Server Error", http.StatusInternalServerError)
}

// ---------------------------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------------------------

func (a *app) feed(w http.ResponseWriter, r *http.Request) {
	posts, err := a.api.Feed()
	if err != nil {
		serverError(w, err)
		return
	}
	// A rejected post comes back as /?error=... (Post/Redirect/Get).
	a.render(w, r, http.StatusOK, "index", pageData{Posts: posts, Error: r.URL.Query().Get("error")})
}

func (a *app) post(w http.ResponseWriter, r *http.Request) {
	post, err := a.api.Post(r.PathValue("id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if post == nil {
		a.notFound(w, r)
		return
	}
	a.render(w, r, http.StatusOK, "post", pageData{Post: post})
}

func (a *app) login(w http.ResponseWriter, r *http.Request) {
	a.render(w, r, http.StatusOK, "login", pageData{})
}

func (a *app) notFound(w http.ResponseWriter, r *http.Request) {
	a.render(w, r, http.StatusNotFound, "not_found", pageData{})
}

// ---------------------------------------------------------------------------------------------------------------
// HTML form routes (plain form posts, Post/Redirect/Get). net/http has no CSRF/origin protection of its own wired in
// here, so these apply the same rule as the other variants: if an Origin header is present, its host[:port] must
// equal the Host header, else 403. The JSON routes under /api are not checked.
// ---------------------------------------------------------------------------------------------------------------

var urlHostRe = regexp.MustCompile(`(?i)^https?://([^/?#]+)`)

func urlHost(u string) string {
	if m := urlHostRe.FindStringSubmatch(u); m != nil {
		return m[1]
	}
	return ""
}

func sameOrigin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if origin, ok := r.Header["Origin"]; ok {
			host := urlHost(origin[0])
			if host == "" || !strings.EqualFold(host, r.Host) {
				http.Error(w, "Cross-site form submission", http.StatusForbidden)
				return
			}
		}
		next(w, r)
	}
}

// backTo is the same-origin path of the page the form was posted from, else /.
func backTo(r *http.Request) string {
	referer := r.Referer()
	host := urlHost(referer)
	if host != "" && strings.EqualFold(host, r.Host) {
		path := referer[strings.Index(referer, "//")+2+len(host):]
		if i := strings.IndexAny(path, "?#"); i >= 0 {
			path = path[:i]
		}
		if strings.HasPrefix(path, "/") {
			return path
		}
	}
	return "/"
}

func redirect(w http.ResponseWriter, location string) {
	w.Header().Set("Location", location)
	w.WriteHeader(http.StatusSeeOther)
}

// encodeURIComponent: url.QueryEscape writes spaces as "+"; the other variants send "%20".
func encodeURIComponent(s string) string {
	return strings.ReplaceAll(url.QueryEscape(s), "+", "%20")
}

func (a *app) loginPost(w http.ResponseWriter, r *http.Request) {
	// Number(user_id) in the JS variants: an integer >= 1 (written as "1", "1.0", " 1 ", ...).
	id, err := strconv.ParseFloat(strings.TrimSpace(r.PostFormValue("user_id")), 64)
	username := strings.TrimSpace(r.PostFormValue("username"))
	if err != nil || id < 1 || id != math.Trunc(id) || id > 1<<53 || username == "" {
		redirect(w, "/login?error=1")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: tokenCookie, Value: signToken(a.secret, int64(id), username),
		Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	redirect(w, "/")
}

func (a *app) createAction(w http.ResponseWriter, r *http.Request) {
	token := currentToken(r)
	if token == "" {
		redirect(w, "/login")
		return
	}
	res, err := a.api.CreatePost("Bearer "+token, r.PostFormValue("body"))
	if err != nil {
		serverError(w, err)
		return
	}
	defer drain(res)
	if res.StatusCode != http.StatusCreated {
		var data struct {
			Error string `json:"error"`
		}
		json.NewDecoder(res.Body).Decode(&data)
		if data.Error == "" {
			data.Error = "error " + strconv.Itoa(res.StatusCode)
		}
		redirect(w, "/?error="+encodeURIComponent(data.Error))
		return
	}
	redirect(w, "/")
}

func (a *app) likeAction(w http.ResponseWriter, r *http.Request) {
	token := currentToken(r)
	if token == "" {
		redirect(w, "/login")
		return
	}
	res, err := a.api.LikePost("Bearer "+token, r.PostFormValue("id"))
	if err != nil {
		serverError(w, err)
		return
	}
	drain(res)
	redirect(w, backTo(r))
}

// ---------------------------------------------------------------------------------------------------------------
// JSON passthrough for the load test: forward Authorization as-is, return the API's status and JSON body unchanged.
// ---------------------------------------------------------------------------------------------------------------

func passthrough(w http.ResponseWriter, res *http.Response, err error) {
	if err != nil {
		serverError(w, err)
		return
	}
	defer res.Body.Close()
	h := w.Header()
	h.Set("Content-Type", "application/json; charset=utf-8")
	if res.ContentLength >= 0 {
		h.Set("Content-Length", strconv.FormatInt(res.ContentLength, 10))
	}
	w.WriteHeader(res.StatusCode)
	io.Copy(w, res.Body)
}

func badJSON(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusBadRequest)
	io.WriteString(w, `{"error":"malformed JSON body"}`)
}

// jsString is String(x) for a decoded JSON value (strings as-is, numbers as written, objects/arrays as JSON).
func jsString(v any) string {
	switch v := v.(type) {
	case nil:
		return ""
	case string:
		return v
	case json.Number:
		return v.String()
	case bool:
		return strconv.FormatBool(v)
	default:
		return string(jsonCompact(v))
	}
}

func (a *app) apiCreate(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		badJSON(w)
		return
	}
	// Strict parse; an empty body or `null` is rejected too, like `(await request.json()).body` in JS.
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil || v == nil || dec.More() {
		badJSON(w)
		return
	}
	body := ""
	if obj, ok := v.(map[string]any); ok {
		body = jsString(obj["body"])
	}
	res, err := a.api.CreatePost(r.Header.Get("Authorization"), body)
	passthrough(w, res, err)
}

func (a *app) apiLike(w http.ResponseWriter, r *http.Request) {
	res, err := a.api.LikePost(r.Header.Get("Authorization"), r.PathValue("id"))
	passthrough(w, res, err)
}

// ---------------------------------------------------------------------------------------------------------------

func main() {
	host := env("HOST", "127.0.0.1")
	port := env("PORT", "3000")
	a := &app{
		api:    newAPI(env("BACKEND_URL", "http://127.0.0.1:4000")),
		secret: []byte(env("JWT_SECRET", "twelve-dollar-challenge")),
		pages:  parsePages(),
	}

	sum := sha256.Sum256(stylesCSS)
	cssETag := `"` + hex.EncodeToString(sum[:8]) + `"`
	started := time.Now()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", a.feed)
	mux.HandleFunc("GET /posts/{id}", a.post)
	mux.HandleFunc("GET /login", a.login)
	mux.HandleFunc("POST /login", sameOrigin(a.loginPost))
	mux.HandleFunc("POST /actions/create", sameOrigin(a.createAction))
	mux.HandleFunc("POST /actions/like", sameOrigin(a.likeAction))
	mux.HandleFunc("POST /api/posts", a.apiCreate)
	mux.HandleFunc("POST /api/posts/{id}/like", a.apiLike)
	mux.HandleFunc("GET /styles.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=0")
		w.Header().Set("ETag", cssETag)
		http.ServeContent(w, r, "styles.css", started, bytes.NewReader(stylesCSS))
	})
	// Unknown paths and methods: the 404 page (header still shows the signed-in user).
	mux.HandleFunc("/", a.notFound)

	srv := &http.Server{
		Addr:              host + ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// PID 1 in Docker gets SIGTERM on `docker stop`: stop accepting, finish in-flight requests, exit.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		srv.Shutdown(shutdown)
	}()

	log.Printf("go listening on http://%s (go %s, GOMAXPROCS=%d, NumCPU=%d)",
		srv.Addr, runtime.Version(), runtime.GOMAXPROCS(0), runtime.NumCPU())
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
