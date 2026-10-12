<?php

namespace App\Support;

use GuzzleHttp\Handler\CurlHandler;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Server-side API client (Laravel's Http client, Guzzle underneath). No caching: every call hits the API.
 * Same functions as the JS variants' src/lib/server/api.ts.
 *
 * Tuned: one Guzzle cURL handler per Octane worker, kept for the worker's lifetime. Laravel's Http client builds
 * a new Guzzle handler (and so new cURL handles) for every request, which means a new TCP connection (and a DNS
 * lookup of the API host) per API call. Guzzle's CurlHandler pools its cURL easy handles; reusing the handler
 * reuses those handles, and libcurl keeps the keep-alive connection (and its DNS cache) on them. Only the
 * transport is shared: the PendingRequest, Guzzle client, cookie jar and headers are still built per call.
 */
final class FeedApi
{
    private static ?CurlHandler $handler = null;

    /** @param  string|null  $authorization  the full header value ("Bearer <jwt>"), or null to send none */
    private static function client(?string $authorization = null): PendingRequest
    {
        $client = Http::baseUrl(config('feed.backend_url'))->setHandler(self::$handler ??= new CurlHandler);

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
