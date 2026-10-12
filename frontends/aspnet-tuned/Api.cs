using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Feed;

/// <summary>A post as the API returns it. <c>CreatedAt</c> stays the raw string (it is the &lt;time datetime&gt; value).</summary>
public sealed record Post(long Id, string Body, string CreatedAt, string Author, long LikeCount);

public sealed record FeedResponse(List<Post> Posts);
public sealed record PostResponse(Post Post);
public sealed record CreateRequest(string Body);
public sealed record ErrorResponse(string? Error);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
[JsonSerializable(typeof(FeedResponse))]
[JsonSerializable(typeof(PostResponse))]
[JsonSerializable(typeof(CreateRequest))]
[JsonSerializable(typeof(ErrorResponse))]
public sealed partial class ApiJson : JsonSerializerContext;

/// <summary>
/// Server-side API client (a typed HttpClient from IHttpClientFactory). No caching: every call hits the API.
/// Same functions as frontends/sveltekit/src/lib/server/api.ts.
/// </summary>
public sealed class ApiClient(HttpClient http)
{
    private static readonly MediaTypeHeaderValue JsonType = new("application/json");

    public async Task<List<Post>> GetFeedAsync(CancellationToken ct)
    {
        using var res = await http.GetAsync("feed", ct);
        if (res.StatusCode != HttpStatusCode.OK)
            throw new HttpRequestException($"feed: backend returned {(int)res.StatusCode}");
        var data = await res.Content.ReadFromJsonAsync(ApiJson.Default.FeedResponse, ct);
        return data!.Posts;
    }

    public async Task<Post?> GetPostAsync(string id, CancellationToken ct)
    {
        using var res = await http.GetAsync("posts/" + Uri.EscapeDataString(id), ct);
        if (res.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest) return null;
        if (res.StatusCode != HttpStatusCode.OK)
            throw new HttpRequestException($"post: backend returned {(int)res.StatusCode}");
        var data = await res.Content.ReadFromJsonAsync(ApiJson.Default.PostResponse, ct);
        return data!.Post;
    }

    /// <summary><paramref name="authorization"/> is the full header value ("Bearer &lt;jwt&gt;"), or null to send none.
    /// Returns the API's status and raw JSON body.</summary>
    public Task<(int Status, byte[] Json)> CreatePostAsync(string? authorization, string body, CancellationToken ct)
    {
        var content = new ByteArrayContent(JsonSerializer.SerializeToUtf8Bytes(new CreateRequest(body), ApiJson.Default.CreateRequest));
        content.Headers.ContentType = JsonType;
        return SendAsync(HttpMethod.Post, "posts", authorization, content, ct);
    }

    public Task<(int Status, byte[] Json)> LikePostAsync(string? authorization, string id, CancellationToken ct) =>
        SendAsync(HttpMethod.Post, $"posts/{Uri.EscapeDataString(id)}/like", authorization, null, ct);

    private async Task<(int, byte[])> SendAsync(HttpMethod method, string path, string? authorization, HttpContent? content, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(method, path) { Content = content };
        if (!string.IsNullOrEmpty(authorization)) req.Headers.TryAddWithoutValidation("Authorization", authorization);
        using var res = await http.SendAsync(req, ct);
        return ((int)res.StatusCode, await res.Content.ReadAsByteArrayAsync(ct));
    }

    /// <summary>The <c>error</c> field of an API error body, if any.</summary>
    public static string? ErrorMessage(byte[] json)
    {
        try { return JsonSerializer.Deserialize(json, ApiJson.Default.ErrorResponse)?.Error; }
        catch (JsonException) { return null; }
    }
}

public static class Dates
{
    /// <summary>
    /// Same text as the JS variants' <c>new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short",
    /// timeZone: "UTC" })</c> plus " UTC", e.g. "Dec 31, 2025, 11:59 PM UTC" (plain spaces, no zero-padded day/hour).
    /// </summary>
    public static string Format(string createdAt) =>
        DateTimeOffset.TryParse(createdAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d)
            ? d.UtcDateTime.ToString("MMM d, yyyy, h:mm tt", CultureInfo.InvariantCulture) + " UTC"
            : createdAt;
}
