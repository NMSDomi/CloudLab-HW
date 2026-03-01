using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Identity;
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
    public async Task<(bool Success, string? Message, User? User, JwtSecurityToken? Jwt, string? RefreshToken)> ValidateUserAndGenerateTokensAsync(string email, string password, SignInManager<User> signInManager)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
            return (false, "Hibás bejelentkezés.", null, null, null);

        var result = await signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            var message = $"Hibás jelszó.";
            return (false, message, user, null, null);
        }

        var roles = await userManager.GetRolesAsync(user);
        var jwt = GenerateJwtToken(user, roles);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await userManager.UpdateAsync(user);

        return (true, null, user, jwt, refreshToken);
    }

    public async Task<bool> ResetUserPasswordAsync(string email, string newPassword)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user == null) return false;

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, newPassword);

        return result.Succeeded;
    }

    public async Task<(string AccessToken, string RefreshToken, DateTime Expires)> RefreshTokenAsync(string expiredToken, string refreshToken)
    {
        var principal = GetPrincipalFromExpiredToken(expiredToken) ?? throw new SecurityTokenException($"Érvénytelen token {expiredToken}");
        var email = principal.FindFirstValue(ClaimTypes.Email);
        var user = await userManager.FindByEmailAsync(email);
        if (user == null || user.RefreshToken != refreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            throw new SecurityTokenException("Érvénytelen vagy lejárt refresh token");

        var roles = await userManager.GetRolesAsync(user);
        var newJwtToken = GenerateJwtToken(user, roles);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await userManager.UpdateAsync(user);

        return (new JwtSecurityTokenHandler().WriteToken(newJwtToken), newRefreshToken, newJwtToken.ValidTo);
    }

    private string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
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

    private ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(systemContext.JWT_KEY)),
            ValidateLifetime = false
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);
        var jwtSecurityToken = securityToken as JwtSecurityToken;

        if (jwtSecurityToken == null || !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Invalid token");
        }

        return principal;
    }
}
