# django-tuned (../django + Jinja2 backend + precompiled stdlib, see README.md). Django + gunicorn for the 2-server simulation (sim/): SSR on every request, no caching, 3 sync workers.
FROM python:3.14.8-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
# django-tuned: the python:3.14.8-slim image ships the stdlib without most .pyc files (email/, http/, ... have no
# __pycache__), and PYTHONDONTWRITEBYTECODE=1 stops Python from caching them, so every HEALTHCHECK run (`python -c
# "import urllib.request ..."`, every 2 s) recompiled urllib/http.client/email from source: 134 ms vs 21 ms per import,
# ~83 ms of CPU per second = 21% of a 0.4-vCPU quota. Precompile once at build time.
RUN python -m compileall -q /usr/local/lib/python3.14
COPY . .
# Hashed + gzipped copy of static/styles.css into staticfiles/ (served by WhiteNoise)
RUN python manage.py collectstatic --noinput
HEALTHCHECK --interval=2s --retries=30 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3000/', timeout=2)" || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec gunicorn -c gunicorn.conf.py feedsite.wsgi"]
