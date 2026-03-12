using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using cloudhw_BE.Setup;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace cloudhw_BE.Controllers;
[Route("api/[controller]")]
[ApiController]
public class UserController(
    UserManager<User> _userManager,
    SignInManager<User> _signInManager,
    IAuthService _authService,
    IEmailService _emailService,
    DataContext _dbContext
    ) : ControllerBase
{
    /// Sets the refresh token as an HttpOnly cookie.
    /// SameSite=Lax works for localhost cross-port (same eTLD+1);
    /// Secure is set only when the request is already HTTPS (production).
    private void SetRefreshCookie(string token, bool remember)
    {
        // In production (behind TLS-terminating LB) always send Secure cookies.
        // In Development, allow non-HTTPS for local testing.
        var env = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>();
        var isSecure = !env.IsDevelopment() || Request.IsHttps;

        var opts = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = SameSiteMode.Lax,
            Path = "/api/user"
        };
        if (remember) opts.Expires = DateTimeOffset.UtcNow.AddDays(30); // else: session cookie
        Response.Cookies.Append("refresh_token", token, opts);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitSetup.AuthPolicy)]
    public async Task<IActionResult> Login([FromBody] LoginRequest model)
    {
        var (success, message, user, jwt, refreshToken) = await _authService.ValidateUserAndGenerateTokensAsync(model.Email, model.Password, model.RememberMe, _signInManager);
        if (!success)
        {
            return Unauthorized(new { message });
        }

        SetRefreshCookie(refreshToken!, model.RememberMe);
        return Ok(new
        {
            token = new JwtSecurityTokenHandler().WriteToken(jwt!),
            expires = jwt!.ValidTo
        });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        await _userManager.UpdateAsync(user);

        Response.Cookies.Delete("refresh_token", new CookieOptions { Path = "/api/user" });
        return Ok();
    }

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(new { message = "No refresh token" });

        try
        {
            var result = await _authService.RefreshTokenAsync(refreshToken);
            SetRefreshCookie(result.RefreshToken, result.IsRemembered);
            return Ok(new
            {
                token = result.AccessToken,
                expires = result.Expires
            });
        }
        catch (SecurityTokenException ex)
        {
            return Unauthorized(ex.Message);
        }
    }


    [HttpGet("all")]
    [Authorize(Roles = $"{RoleNames.Admin}")]
    public async Task<IActionResult> GetAllUsers()
    {
        // Single query: join Users → UserRoles → Roles to avoid N+1 round-trips
        var usersWithRoles = await (
            from u in _userManager.Users
            select new
            {
                u.Id,
                u.Email,
                u.Name,
                u.UserName,
                Roles = (
                    from ur in _dbContext.UserRoles
                    join r  in _dbContext.Roles on ur.RoleId equals r.Id
                    where ur.UserId == u.Id
                    select r.Name
                ).FirstOrDefault()
            }
        ).ToListAsync();

        return Ok(usersWithRoles);
    }

    [HttpGet("search")]
    [Authorize]
    public async Task<IActionResult> SearchUsers([FromQuery] string q)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(Array.Empty<object>());

        var lq = q.ToLower();
        var users = await _userManager.Users
            .Where(u => u.Id != currentUserId &&
                        (u.Name.ToLower().Contains(lq) || u.Email!.ToLower().Contains(lq)))
            .Take(10)
            .Select(u => new { u.Id, u.Name })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> GetUserById(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new
        {
            user.Id,
            user.Email,
            user.Name,
            user.UserName,
            Roles = roles.FirstOrDefault()
        });
    }

    /// <summary>
    /// Public profile lookup — any authenticated user can fetch another user's display name.
    /// Returns only non-sensitive fields (Id, Name). Email is intentionally omitted.
    /// </summary>
    [HttpGet("public/{id}")]
    [Authorize]
    public async Task<IActionResult> GetPublicProfile(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        return Ok(new { user.Id, user.Name });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new
        {
            user.Id,
            user.Email,
            user.Name,
            user.UserName,
            Roles = roles.FirstOrDefault()
        });
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateOwnProfile([FromBody] UpdateProfileRequest model)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        // Name update is applied immediately.
        user.Name = model.Name;

        // Email change requires confirmation to the new address.
        // The change is NOT applied until the user clicks the link.
        if (!string.Equals(user.Email, model.Email, StringComparison.OrdinalIgnoreCase))
        {
            // Ensure the requested email is not already taken by another account
            var existing = await _userManager.FindByEmailAsync(model.Email);
            if (existing != null && existing.Id != user.Id)
                return BadRequest(new { message = "Ez az email cím már használatban van." });

            var token = await _userManager.GenerateChangeEmailTokenAsync(user, model.Email);
            try
            {
                await _emailService.SendChangeEmailConfirmationAsync(user.Email!, model.Email, user.Id, token);
            }
            catch (Exception ex)
            {
                var logger = HttpContext.RequestServices.GetRequiredService<ILogger<UserController>>();
                logger.LogError(ex, "Failed to send change-email confirmation to {Email}", model.Email);
            }

            var nameResult = await _userManager.UpdateAsync(user);
            if (!nameResult.Succeeded) return BadRequest(nameResult.Errors);

            return Ok(new { message = "Név frissítve. Az email cím módosításához kérjük erősítsd meg az új címet a kiüldött linkre kattintva." });
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok();
    }

    [HttpGet("confirm-email-change")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmailChange([FromQuery] string userId, [FromQuery] string newEmail, [FromQuery] string token)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(newEmail) || string.IsNullOrEmpty(token))
            return BadRequest(new { message = "Érvénytelen megerősítő link." });

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return BadRequest(new { message = "Érvénytelen megerősítő link." });

        var result = await _userManager.ChangeEmailAsync(user, newEmail, token);
        if (!result.Succeeded)
            return BadRequest(new { message = "A megerősítő link érvénytelen vagy lejárt." });

        // Keep UserName in sync with the new email
        user.UserName = newEmail;
        await _userManager.UpdateNormalizedUserNameAsync(user);

        return Ok(new { message = "Email cím sikeresen megváltoztatva!" });
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitSetup.AuthPolicy)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest model)
    {
        var user = new User
        {
            UserName = model.Email,
            Email = model.Email,
            Name = model.Name
        };

        var result = await _userManager.CreateAsync(user, model.Password);

        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await _userManager.AddToRoleAsync(user, RoleNames.Editor);

        // Generate email confirmation token and send email.
        // Email failure must not roll back the registration — user is already created.
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        try
        {
            await _emailService.SendConfirmationEmailAsync(user.Email!, user.Id, token);
        }
        catch (Exception ex)
        {
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<UserController>>();
            logger.LogError(ex, "Failed to send confirmation email to {Email}", user.Email);
        }

        return Ok(new { message = "Sikeres regisztráció. Kérjük, erősítsd meg az email címedet a kiküldött linkre kattintva." });
    }

    [HttpGet("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmail([FromQuery] string userId, [FromQuery] string token)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(token))
            return BadRequest(new { message = "Érvénytelen megerősítő link." });

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return BadRequest(new { message = "Érvénytelen megerősítő link." });

        var result = await _userManager.ConfirmEmailAsync(user, token);
        if (!result.Succeeded)
            return BadRequest(new { message = "A megerősítő link érvénytelen vagy lejárt." });

        return Ok(new { message = "Email sikeresen megerősítve! Most már bejelentkezhetsz." });
    }

    [HttpPost("resend-confirmation")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitSetup.AuthPolicy)]
    public async Task<IActionResult> ResendConfirmationEmail([FromBody] ResendConfirmationRequest model)
    {
        // Always return OK to prevent user enumeration
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null || await _userManager.IsEmailConfirmedAsync(user))
            return Ok(new { message = "Ha az email cím regisztrálva van, küldtünk egy új megerősítő levelet." });

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        try
        {
            await _emailService.SendConfirmationEmailAsync(user.Email!, user.Id, token);
        }
        catch (Exception ex)
        {
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<UserController>>();
            logger.LogError(ex, "Failed to send confirmation email to {Email}", user.Email);
        }

        return Ok(new { message = "Ha az email cím regisztrálva van, küldtünk egy új megerősítő levelet." });
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitSetup.AuthPolicy)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest model)
    {
        // Always return OK to prevent user enumeration
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null || !await _userManager.IsEmailConfirmedAsync(user))
            return Ok(new { message = "Ha az email cím regisztrálva van, küldtünk egy jelszó visszaállító levelet." });

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        try
        {
            await _emailService.SendPasswordResetEmailAsync(user.Email!, token);
        }
        catch (Exception ex)
        {
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<UserController>>();
            logger.LogError(ex, "Failed to send password reset email to {Email}", user.Email);
        }

        return Ok(new { message = "Ha az email cím regisztrálva van, küldtünk egy jelszó visszaállító levelet." });
    }


    private static readonly HashSet<string> ValidRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        RoleNames.Admin, RoleNames.Editor
    };

    [HttpPut("role/{id}")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> UpdateUserRole(string id, [FromBody] UpdateRoleRequest model)
    {
        if (!ValidRoles.Contains(model.Role))
            return BadRequest($"Érvénytelen szerepkör: '{model.Role}'. Engedélyezett: {string.Join(", ", ValidRoles)}");

        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound("Felhasználó nem található.");

        var currentRoles = await _userManager.GetRolesAsync(user);
        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
        if (!removeResult.Succeeded) return BadRequest("Nem sikerült a jelenlegi szerepeket eltávolítani.");

        var addResult = await _userManager.AddToRoleAsync(user, model.Role);
        if (!addResult.Succeeded) return BadRequest("Nem sikerült az új szerepkört beállítani.");

        return Ok();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitSetup.AuthPolicy)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordWithTokenRequest model)
    {
        // Use the same generic error message regardless of whether the email
        // exists or the token is invalid to prevent user enumeration.
        const string genericError = "A jelszó visszaállítás sikertelen. A link érvénytelen vagy lejárt.";

        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null)
            return BadRequest(new { message = genericError });

        // Prevent reusing the current password
        if (await _userManager.CheckPasswordAsync(user, model.NewPassword))
            return BadRequest(new { message = "Az új jelszó nem egyezhet a régi jelszóval." });

        var result = await _userManager.ResetPasswordAsync(user, model.Token, model.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = genericError });

        // Reset lockout on successful password reset
        await _userManager.SetLockoutEndDateAsync(user, null);

        return Ok(new { message = "Jelszó sikeresen megváltoztatva! Most már bejelentkezhetsz." });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest model)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        // Check if the account is locked out from too many failed attempts
        if (await _userManager.IsLockedOutAsync(user))
        {
            var lockoutEnd = await _userManager.GetLockoutEndDateAsync(user);
            var remaining = lockoutEnd!.Value - DateTimeOffset.UtcNow;
            var mins = (int)remaining.TotalMinutes;
            var secs = remaining.Seconds;
            return BadRequest(new { message = $"Túl sok sikertelen próbálkozás. Próbáld újra {mins} perc {secs} másodperc múlva." });
        }

        // Prevent setting the same password
        var isSamePassword = await _userManager.CheckPasswordAsync(user, model.NewPassword);
        if (isSamePassword)
        {
            return BadRequest(new { message = "Az új jelszó nem egyezhet a jelenlegi jelszóval." });
        }

        var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);

        if (!result.Succeeded)
        {
            // Increment failed access count when current password is wrong
            await _userManager.AccessFailedAsync(user);
            return BadRequest(result.Errors);
        }

        // Reset lockout on success
        await _userManager.ResetAccessFailedCountAsync(user);

        return Ok(new { message = "Jelszó sikeresen megváltoztatva!" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> Delete(string id)
    {
        // Prevent admins from deleting themselves
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == currentUserId)
            return BadRequest(new { message = "Nem törölheted saját fiókodat." });

        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        // Prevent deleting the last remaining admin
        if (await _userManager.IsInRoleAsync(user, RoleNames.Admin))
        {
            var adminCount = (await _userManager.GetUsersInRoleAsync(RoleNames.Admin)).Count;
            if (adminCount <= 1)
                return BadRequest(new { message = "Nem törölhető az utolsó admin fiók." });
        }

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok();
    }
}