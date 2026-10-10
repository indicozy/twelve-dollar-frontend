using System.Text.Json;
using Feed;

var builder = WebApplication.CreateBuilder(args);

// HOST/PORT (SPEC.md) map to the Kestrel URL; the Docker image sets HOST=0.0.0.0 PORT=3000.
var host = Environment.GetEnvironmentVariable("HOST") is { Length: > 0 } h ? h : "127.0.0.1";
var port = Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } p ? p : "3000";
builder.WebHost.UseUrls($"http://{host}:{port}");

var backendUrl = Environment.GetEnvironmentVariable("BACKEND_URL") is { Length: > 0 } b ? b : "http://127.0.0.1:4000";

builder.Services.AddRazorPages();
// Typed client from IHttpClientFactory (pooled SocketsHttpHandler, keep-alive to the API). No caching anywhere.
builder.Services.AddHttpClient<ApiClient>(c => c.BaseAddress = new Uri(backendUrl.TrimEnd('/') + "/"));

var app = builder.Build();

// wwwroot/styles.css (fingerprinted URL, ETag, precompressed gzip/brotli variants built at publish time).
app.MapStaticAssets();
// Every page is rendered on every request: no output caching, no response caching.
app.MapRazorPages().WithStaticAssets();

// JSON pass-through for the load test's writes. Minimal API endpoints that don't bind form data
// are not subject to antiforgery validation.
app.MapPost("/api/posts", async (HttpContext ctx, ApiClient api) =>
{
    string body;
    try
    {
        using var doc = await JsonDocument.ParseAsync(ctx.Request.Body, cancellationToken: ctx.RequestAborted);
        body = BodyField(doc.RootElement);
    }
    catch (JsonException)
    {
        await WriteJson(ctx.Response, 400, """{"error":"malformed JSON body"}"""u8.ToArray());
        return;
    }
    var (status, json) = await api.CreatePostAsync(ctx.Request.Headers.Authorization, body, ctx.RequestAborted);
    await WriteJson(ctx.Response, status, json);
});

app.MapPost("/api/posts/{id}/like", async (HttpContext ctx, string id, ApiClient api) =>
{
    var (status, json) = await api.LikePostAsync(ctx.Request.Headers.Authorization, id, ctx.RequestAborted);
    await WriteJson(ctx.Response, status, json);
});

// Unknown paths: the 404 page (status 404), with the header like every other page.
app.MapFallbackToPage("{*path}", "/NotFound");

app.Run();

// `String((await request.json()).body ?? "")` from the JS variants: a JSON `null` document throws there (-> 400).
static string BodyField(JsonElement root)
{
    if (root.ValueKind == JsonValueKind.Null) throw new JsonException("null body");
    if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("body", out var v)) return "";
    return v.ValueKind switch
    {
        JsonValueKind.String => v.GetString()!,
        JsonValueKind.Null => "",
        _ => v.GetRawText(),
    };
}

static Task WriteJson(HttpResponse res, int status, byte[] json)
{
    res.StatusCode = status;
    res.ContentType = "application/json";
    res.ContentLength = json.Length;
    return res.Body.WriteAsync(json).AsTask();
}
