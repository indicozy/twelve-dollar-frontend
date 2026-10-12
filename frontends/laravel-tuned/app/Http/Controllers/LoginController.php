<?php

namespace App\Http\Controllers;

use App\Support\DemoToken;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;

class LoginController extends Controller
{
    /** POST /login : signs a demo token and stores the raw JWT in an httpOnly `token` session cookie. */
    public function store(Request $request): RedirectResponse
    {
        $id = filter_var($request->input('user_id'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $username = trim((string) $request->input('username', ''));
        if ($id === false || $username === '') {
            return redirect('/login?error=1', 303);
        }

        // name, value, minutes (0 = browser session), path, domain, secure, httpOnly, raw, sameSite
        $cookie = Cookie::make(DemoToken::COOKIE, DemoToken::sign($id, $username), 0, '/', null, false, true, false, 'lax');

        return redirect('/', 303)->withCookie($cookie);
    }
}
