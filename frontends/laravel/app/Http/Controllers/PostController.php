<?php

namespace App\Http\Controllers;

use App\Support\FeedApi;
use Illuminate\View\View;

class PostController extends Controller
{
    /** GET /posts/{id} : the whole page renders before anything is sent, so a missing post is a real 404. */
    public function show(string $id): View
    {
        $post = FeedApi::post($id);
        abort_if($post === null, 404);

        return view('post', ['post' => $post]);
    }
}
