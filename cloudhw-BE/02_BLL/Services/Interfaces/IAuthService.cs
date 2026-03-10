using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Identity;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace cloudhw_BE.BLL.Services.Interfaces;

public interface IAuthService
{
    Task<(bool Success, string? Message, User? User, JwtSecurityToken? Jwt, string? RefreshToken)> ValidateUserAndGenerateTokensAsync(string email, string password, bool rememberMe, SignInManager<User> signInManager);
    Task<(string AccessToken, string RefreshToken, DateTime Expires, bool IsRemembered)> RefreshTokenAsync(string refreshToken);
}
