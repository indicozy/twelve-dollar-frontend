<?php

use App\Http\Controllers\Api\PostApiController;
use Illuminate\Support\Facades\Route;

// Prefixed with /api and run in the `api` middleware group (no session, no CSRF), see bootstrap/app.php.
Route::post('/posts', [PostApiController::class, 'create']);
Route::post('/posts/{id}/like', [PostApiController::class, 'like']);
