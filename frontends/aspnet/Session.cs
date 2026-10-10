using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace Feed;

/// <summary>Demo login token and cookie reading, like frontends/sveltekit/src/lib/server/session.ts.</summary>
public static class Session
{
    public const string TokenCookie = "token";

    private static readonly byte[] Secret =
        Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("JWT_SECRET") ?? "twelve-dollar-challenge");

    // base64url('{"alg":"HS256","typ":"JWT"}'), the same header bytes as JSON.stringify produces.
    private static readonly string Header = Base64Url.EncodeToString("""{"alg":"HS256","typ":"JWT"}"""u8);

    // JSON.stringify-style escaping (only quotes, backslashes and control characters).
    private static readonly JsonWriterOptions WriterOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    /// <summary>Same HS256 tokens as the challenge's seed/tokens.json (no login endpoint exists on the API).</summary>
    public static string SignToken(long userId, string username)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer, WriterOptions))
        {
            w.WriteStartObject();
            w.WriteString("sub", userId.ToString(System.Globalization.CultureInfo.InvariantCulture));
            w.WriteString("username", username);
            w.WriteNumber("iat", now);
            w.WriteNumber("exp", now + 7 * 86400);
            w.WriteEndObject();
        }
        var signingInput = Header + "." + Base64Url.EncodeToString(buffer.ToArray());
        var sig = HMACSHA256.HashData(Secret, Encoding.ASCII.GetBytes(signingInput));
        return signingInput + "." + Base64Url.EncodeToString(sig);
    }

    public static string? CurrentToken(HttpRequest request) =>
        request.Cookies.TryGetValue(TokenCookie, out var t) && !string.IsNullOrEmpty(t) ? t : null;

    /// <summary>The <c>username</c> claim of the token cookie, read on every request (the signature isn't checked, as in the JS variants).</summary>
    public static string? CurrentUsername(HttpRequest request)
    {
        var token = CurrentToken(request);
        if (token is null) return null;
        var parts = token.Split('.');
        if (parts.Length < 2) return null;
        try
        {
            using var doc = JsonDocument.Parse(Base64Url.DecodeFromChars(parts[1]));
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("username", out var u) && u.ValueKind == JsonValueKind.String
                ? u.GetString()
                : null;
        }
        catch (Exception e) when (e is FormatException or JsonException)
        {
            return null;
        }
    }
}
