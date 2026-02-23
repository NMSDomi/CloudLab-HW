using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Identity;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace cloudhw_BE.BLL.Services.Interfaces;

public interface IAuthService
{
    Task<(bool Success, string? Message, User? User, JwtSecurityToken? Jwt, string? RefreshToken)> ValidateUserAndGenerateTokensAsync(string email, string password, SignInManager<User> signInManager);
    Task<bool> ResetUserPasswordAsync(string email, string newPassword);
    Task<(string AccessToken, string RefreshToken, DateTime Expires)> RefreshTokenAsync(string expiredToken, string refreshToken);
}
