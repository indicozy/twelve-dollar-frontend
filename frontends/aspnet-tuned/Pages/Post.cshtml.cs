using Microsoft.AspNetCore.Mvc;

namespace Feed.Pages;

public sealed class PostModel(ApiClient api) : FeedPageModel(api)
{
    public Post? Post { get; private set; }

    // The post is fetched before any HTML is written, so a missing or invalid id is a real 404 (the 404 page).
    public async Task OnGetAsync(string id, CancellationToken ct)
    {
        Post = await Api.GetPostAsync(id, ct);
        if (Post is null) Response.StatusCode = StatusCodes.Status404NotFound;
    }

    public Task<IActionResult> OnPostLikeAsync(string? id, CancellationToken ct) =>
        LikeAsync(id, Request.Path.ToUriComponent(), ct);
}
