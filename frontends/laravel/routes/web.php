<?php

use App\Http\Controllers\FeedController;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\PostController;
use Illuminate\Support\Facades\Route;

// The `web` middleware group: cookies, session (file driver), CSRF. Every page is rendered on every request.
Route::get('/', [FeedController::class, 'index']);
Route::post('/posts', [FeedController::class, 'create']);
Route::post('/like', [FeedController::class, 'like']);
Route::get('/posts/{id}', [PostController::class, 'show']);
Route::view('/login', 'login');
Route::post('/login', [LoginController::class, 'store']);
