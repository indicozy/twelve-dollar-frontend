<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Demo login tokens: the same HS256 JWTs as the challenge's seed/tokens.json and
 * frontends/sveltekit/src/lib/server/session.ts (the API has no login endpoint).
 * The `token` cookie holds the raw JWT; it is excluded from EncryptCookies in bootstrap/app.php.
 */
final class DemoToken
{
    public const COOKIE = 'token';

    private const JSON = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;

    private static function b64url(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    public static function sign(int $userId, string $username): string
    {
        $now = time();
        $head = self::b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], self::JSON));
        $body = self::b64url(json_encode(
            ['sub' => (string) $userId, 'username' => $username, 'iat' => $now, 'exp' => $now + 7 * 86400],
            self::JSON,
        ));
        $sig = self::b64url(hash_hmac('sha256', "$head.$body", (string) config('feed.jwt_secret'), true));

        return "$head.$body.$sig";
    }

    public static function current(Request $request): ?string
    {
        $token = $request->cookie(self::COOKIE);

        return is_string($token) && $token !== '' ? $token : null;
    }

    /** The signed-in name, read from the token's payload on every request (not verified, like the JS variants). */
    public static function username(Request $request): ?string
    {
        $token = self::current($request);
        if ($token === null) {
            return null;
        }
        $payload = json_decode((string) base64_decode(strtr(explode('.', $token)[1] ?? '', '-_', '+/')), true);
        $name = is_array($payload) ? ($payload['username'] ?? null) : null;

        return is_scalar($name) && $name !== '' ? (string) $name : null;
    }
}
