# flask-tuned: ../flask plus a precompiled standard library (see README.md). Flask + Jinja2 under gunicorn for the 2-server simulation (sim/): SSR on every request, no caching,
# gunicorn master + 3 sync workers (see gunicorn.conf.py and README.md).
FROM python:3.14.8-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 HOST=0.0.0.0 PORT=3000
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
# The python:3.14.8-slim image ships most of the stdlib without .pyc files and PYTHONDONTWRITEBYTECODE=1 stops Python
# caching them, so the HEALTHCHECK below (every 2 s) recompiled urllib/http.client/email from source each time: ~20% of
# the 0.4-vCPU quota (research/anomalies-nonjs.md). Precompile once at build time.
RUN python -m compileall -q /usr/local/lib/python3.14
COPY app.py gunicorn.conf.py ./
COPY templates ./templates
COPY static ./static
HEALTHCHECK --interval=2s --retries=30 CMD python -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:3000/', timeout=2)" || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec gunicorn -c gunicorn.conf.py app:app"]
