using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace cloudhw_BE.BLL.Services;

public class AuthService(
    ISystemContext systemContext,
    UserManager<User> userManager
    ) : IAuthService
{
    public async Task<(bool Success, string? Message, User? User, JwtSecurityToken? Jwt, string? RefreshToken)> ValidateUserAndGenerateTokensAsync(string email, string password, bool rememberMe, SignInManager<User> signInManager)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
            return (false, "Hibás email vagy jelszó.", null, null, null);

        var result = await signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);

        if (result.IsLockedOut)
        {
            var lockoutEnd = await userManager.GetLockoutEndDateAsync(user);
            var remaining = lockoutEnd.HasValue ? lockoutEnd.Value - DateTimeOffset.UtcNow : TimeSpan.Zero;
            if (remaining.TotalSeconds > 0)
            {
                var minutes = (int)Math.Ceiling(remaining.TotalMinutes);
                var seconds = (int)Math.Ceiling(remaining.TotalSeconds);
                var timeText = minutes >= 1
                    ? $"{minutes} perc {seconds % 60} másodperc"
                    : $"{seconds} másodperc";
                return (false, $"A fiók ideiglenesen zárolva. Próbáld újra {timeText} múlva.", null, null, null);
            }
            return (false, "A fiók ideiglenesen zárolva. Próbáld újra később.", null, null, null);
        }

        if (result.IsNotAllowed)
        {
            if (!await userManager.IsEmailConfirmedAsync(user))
                return (false, "Kérjük, erősítsd meg az email címedet a regisztrációkor kapott linkre kattintva.", null, null, null);
            return (false, "A bejelentkezés nem engedélyezett.", null, null, null);
        }

        if (!result.Succeeded)
        {
            return (false, "Hibás email vagy jelszó.", null, null, null);
        }

        var roles = await userManager.GetRolesAsync(user);
        var jwt = GenerateJwtToken(user, roles);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = HashToken(refreshToken);
        user.RefreshTokenExpiryTime = rememberMe
            ? DateTime.UtcNow.AddDays(30)
            : DateTime.UtcNow.AddDays(1);
        await userManager.UpdateAsync(user);

        return (true, null, user, jwt, refreshToken);
    }

    public async Task<(string AccessToken, string RefreshToken, DateTime Expires, bool IsRemembered)> RefreshTokenAsync(string refreshToken)
    {
        var tokenHash = HashToken(refreshToken);
        var user = await userManager.Users.FirstOrDefaultAsync(u => u.RefreshToken == tokenHash)
            ?? throw new SecurityTokenException("Invalid refresh token");

        if (user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            throw new SecurityTokenException("Refresh token expired");

        // Infer whether this was a "remember me" session from the original expiry
        var isRemembered = user.RefreshTokenExpiryTime > DateTime.UtcNow.AddDays(2);

        var roles = await userManager.GetRolesAsync(user);
        var newJwtToken = GenerateJwtToken(user, roles);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = HashToken(newRefreshToken);
        user.RefreshTokenExpiryTime = isRemembered
            ? DateTime.UtcNow.AddDays(30)
            : DateTime.UtcNow.AddDays(1);
        await userManager.UpdateAsync(user);

        return (new JwtSecurityTokenHandler().WriteToken(newJwtToken), newRefreshToken, newJwtToken.ValidTo, isRemembered);
    }

    private string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    /// <summary>
    /// Returns SHA-256 hash of a token. Stored in the DB so a plain DB breach
    /// cannot be used to replay sessions directly.
    /// </summary>
    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }

    private JwtSecurityToken GenerateJwtToken(User user, IList<string> roles)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? ""),
            new(JwtRegisteredClaimNames.Email, user.Email ?? "")
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(systemContext.JWT_KEY));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        return new JwtSecurityToken(
            issuer: systemContext.JWT_ISSUER,
            audience: systemContext.JWT_AUDIANCE,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds
        );
    }

}
