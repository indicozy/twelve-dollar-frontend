# gunicorn settings (loaded with `gunicorn -c gunicorn.conf.py app:app`). See README.md, "Process model".
import os

bind = f"{os.environ.get('HOST', '127.0.0.1')}:{os.environ.get('PORT', '3000')}"

# gunicorn's documented starting point is (2 x $num_cores) + 1 workers. The sim server has 1 vCPU, so 3. Hard-coded
# rather than derived from os.cpu_count(), which would see the host's cores, not the container's CPU quota.
workers = 3

# The default worker class: one request at a time per process; it blocks while waiting on the API call.
worker_class = "sync"

# The sync worker closes the connection after every response (no HTTP keep-alive); `keepalive` is ignored by it.

# Logs to stderr: errors only, no access log (like the Node variants, which log nothing per request).
accesslog = None
errorlog = "-"
loglevel = "warning"
