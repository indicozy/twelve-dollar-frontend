using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Feed.Pages;

public sealed class LoginModel : PageModel
{
    public void OnGet() { }

    public IActionResult OnPost([FromForm(Name = "user_id")] string? userId, [FromForm(Name = "username")] string? username)
    {
        username = username?.Trim();
        var valid = long.TryParse(userId?.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && id >= 1
            && !string.IsNullOrEmpty(username);
        Response.Headers.Location = valid ? "/" : "/login?error=1";
        if (valid)
        {
            Response.Cookies.Append(Session.TokenCookie, Session.SignToken(id, username!),
                new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Path = "/", Secure = false });
        }
        return new StatusCodeResult(StatusCodes.Status303SeeOther);
    }
}
