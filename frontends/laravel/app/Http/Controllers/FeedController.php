<?php

namespace App\Http\Controllers;

use App\Support\DemoToken;
use App\Support\FeedApi;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class FeedController extends Controller
{
    /** GET / : rendered on every request from a fresh API call (no caching). */
    public function index(Request $request): View
    {
        return view('feed', [
            'posts' => FeedApi::feed(),
            // The API's error from a rejected compose form (flashed by create() below).
            'error' => $request->session()->get('error'),
        ]);
    }

    /** POST /posts : the compose form. Post/Redirect/Get. */
    public function create(Request $request): RedirectResponse
    {
        $token = DemoToken::current($request);
        if (! $token) {
            return redirect('/login', 303);
        }
        $res = FeedApi::createPost("Bearer $token", (string) $request->input('body', ''));
        if ($res->status() !== 201) {
            return redirect('/', 303)->with('error', $res->json('error') ?? "error {$res->status()}");
        }

        return redirect('/', 303);
    }

    /** POST /like : the like form on the feed and post pages. Redirects back to the page it came from. */
    public function like(Request $request): RedirectResponse
    {
        $token = DemoToken::current($request);
        if (! $token) {
            return redirect('/login', 303);
        }
        FeedApi::likePost("Bearer $token", (string) $request->input('id', ''));

        return redirect()->back(303, [], '/');
    }
}
