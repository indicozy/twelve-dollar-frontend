using Microsoft.AspNetCore.Mvc;

namespace Feed.Pages;

public sealed class IndexModel(ApiClient api) : FeedPageModel(api)
{
    public List<Post> Posts { get; private set; } = [];
    public string? Error { get; private set; }

    // Rendered on every request from a fresh API call (no caching), like frontends/nextjs.
    public async Task OnGetAsync(CancellationToken ct) => Posts = await Api.GetFeedAsync(ct);

    public async Task<IActionResult> OnPostCreateAsync(string? body, CancellationToken ct)
    {
        var token = Session.CurrentToken(Request);
        if (token is null) return SeeOther("/login");
        var (status, json) = await Api.CreatePostAsync("Bearer " + token, body ?? "", ct);
        if (status == StatusCodes.Status201Created) return SeeOther("/");
        // A rejected post (e.g. empty or too long) re-renders the feed with the API's error and status.
        Error = ApiClient.ErrorMessage(json) ?? $"error {status}";
        Response.StatusCode = status;
        Posts = await Api.GetFeedAsync(ct);
        return Page();
    }

    public Task<IActionResult> OnPostLikeAsync(string? id, CancellationToken ct) => LikeAsync(id, "/", ct);
}
