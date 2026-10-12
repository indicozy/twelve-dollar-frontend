<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery as Middleware;

/**
 * Laravel's CSRF middleware (token checked on every POST form, as before), minus the `XSRF-TOKEN` cookie.
 * That cookie exists so JavaScript HTTP clients (Axios) can echo the token in a header; these pages ship no JS and
 * every form carries the token in its hidden `_token` field, so it was an encrypted cookie set on every response
 * for nothing.
 */
class PreventRequestForgery extends Middleware
{
    protected $addHttpCookie = false;
}
