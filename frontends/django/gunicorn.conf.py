"""gunicorn settings (`gunicorn -c gunicorn.conf.py feedsite.wsgi`). Same process model as frontends/flask.

- workers: gunicorn's documented starting point is (2 x CPU cores) + 1. The benchmark box has 1 vCPU, so 3. It is
  hard-coded rather than computed from os.cpu_count(), which inside the container reports the host's cores, not the
  container's CPU quota. WEB_CONCURRENCY overrides it (gunicorn's own convention).
- worker_class: the default "sync" worker. Each worker handles one request at a time and blocks while it waits for
  the API, so at most 3 requests are in flight; the others wait in the listen backlog. The extra workers exist so the
  CPU has work while one worker is blocked on I/O. With a 0.4 vCPU quota the 3 workers share 40% of a core, and
  under load they queue for CPU instead of I/O.
- Sync workers don't do HTTP keep-alive: every response has `Connection: close`, so each client request is a new
  TCP connection (the keepalive setting only applies to async workers).
"""
import os

bind = f"{os.environ.get('HOST', '0.0.0.0')}:{os.environ.get('PORT', '3000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "3"))
worker_class = "sync"
# Defaults, listed for visibility: no --preload (each worker imports the app and opens its own API connection pool),
# 30 s worker timeout, no access log (like the Node variants, which log nothing per request).
preload_app = False
timeout = 30
accesslog = None
