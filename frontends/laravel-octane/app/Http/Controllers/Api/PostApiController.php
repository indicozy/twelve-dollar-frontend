<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeedApi;
use Illuminate\Http\Client\Response as ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use JsonException;

/**
 * JSON passthrough so load tests can write through the frontend server (routes/api.php: no session, no CSRF).
 * The incoming Authorization header is forwarded as-is; the API's status and JSON body are returned unchanged.
 */
class PostApiController extends Controller
{
    public function create(Request $request): Response|JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return response()->json(['error' => 'malformed JSON body'], 400);
        }
        if ($data === null) { // `null.body` throws in the JS variants
            return response()->json(['error' => 'malformed JSON body'], 400);
        }
        $body = is_array($data) ? ($data['body'] ?? '') : '';
        $body = match (true) {
            is_string($body) => $body,
            is_bool($body) => $body ? 'true' : 'false',
            is_scalar($body) => (string) $body,
            default => json_encode($body),
        };

        return self::passthrough(FeedApi::createPost($request->header('Authorization'), $body));
    }

    public function like(Request $request, string $id): Response
    {
        return self::passthrough(FeedApi::likePost($request->header('Authorization'), $id));
    }

    private static function passthrough(ApiResponse $res): Response
    {
        return response($res->body(), $res->status(), ['Content-Type' => 'application/json']);
    }
}
