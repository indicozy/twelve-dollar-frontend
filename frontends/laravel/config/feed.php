<?php

// Benchmark-specific settings (frontends/SPEC.md). Read from the environment when the config is cached,
// which the Docker entrypoint does at container start (`php artisan config:cache`), so runtime env applies.
return [
    'backend_url' => env('BACKEND_URL', 'http://127.0.0.1:4000'),
    'jwt_secret' => env('JWT_SECRET', 'twelve-dollar-challenge'),
];
