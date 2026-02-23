using Microsoft.AspNetCore.Identity;

namespace cloudhw_BE.DAL.Models;

public class User : IdentityUser
{
    public string Name { get; set; } = string.Empty;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
}