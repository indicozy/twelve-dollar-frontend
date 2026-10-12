using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Feed.Pages;

/// <summary>A post card's view model: the post, and whether to link to its page.</summary>
public sealed record PostCard(Post Post, bool Link);

/// <summary>Shared by the feed and post pages: the like form handler, and Post/Redirect/Get with 303.</summary>
public abstract class FeedPageModel(ApiClient api) : PageModel
{
    protected ApiClient Api { get; } = api;

    /// <summary>303 See Other (RedirectResult only does 301/302/307/308).</summary>
    protected StatusCodeResult SeeOther(string url)
    {
        Response.Headers.Location = url;
        return new StatusCodeResult(StatusCodes.Status303SeeOther);
    }

    /// <summary>The like form (hidden <c>id</c>): forward the token cookie as a bearer token, then redirect back.</summary>
    protected async Task<IActionResult> LikeAsync(string? id, string returnTo, CancellationToken ct)
    {
        var token = Session.CurrentToken(Request);
        if (token is null) return SeeOther("/login");
        await Api.LikePostAsync("Bearer " + token, id ?? "", ct);
        return SeeOther(returnTo);
    }
}
