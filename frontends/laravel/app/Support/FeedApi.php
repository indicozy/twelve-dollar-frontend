<?php

namespace App\Support;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Server-side API client (Laravel's Http client, Guzzle underneath). No caching: every call hits the API.
 * Same functions as the JS variants' src/lib/server/api.ts.
 */
final class FeedApi
{
    /** @param  string|null  $authorization  the full header value ("Bearer <jwt>"), or null to send none */
    private static function client(?string $authorization = null): PendingRequest
    {
        $client = Http::baseUrl(config('feed.backend_url'));

        return $authorization ? $client->withHeaders(['Authorization' => $authorization]) : $client;
    }

    /** @return list<array{id:int, body:string, created_at:string, author:string, like_count:int}> */
    public static function feed(): array
    {
        $res = self::client()->get('/feed');
        if ($res->status() !== 200) {
            throw new RuntimeException("feed: backend returned {$res->status()}");
        }

        return $res->json('posts');
    }

    /** @return array{id:int, body:string, created_at:string, author:string, like_count:int}|null */
    public static function post(string $id): ?array
    {
        $res = self::client()->get('/posts/'.rawurlencode($id));
        if ($res->status() === 404 || $res->status() === 400) {
            return null;
        }
        if ($res->status() !== 200) {
            throw new RuntimeException("post: backend returned {$res->status()}");
        }

        return $res->json('post');
    }

    public static function createPost(?string $authorization, string $body): Response
    {
        return self::client($authorization)->post('/posts', ['body' => $body]);
    }

    public static function likePost(?string $authorization, string $id): Response
    {
        // send() with no options: a POST without a body, like the JS variants' fetch.
        return self::client($authorization)->send('POST', '/posts/'.rawurlencode($id).'/like');
    }
}
