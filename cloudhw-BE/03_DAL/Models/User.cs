using Microsoft.AspNetCore.Identity;

namespace cloudhw_BE.DAL.Models;

public class User : IdentityUser
{
    public string Name { get; set; } = string.Empty;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    /// <summary>Albums this user owns.</summary>
    public ICollection<Album> Albums { get; set; } = new List<Album>();

    /// <summary>Albums shared with this user (many-to-many).</summary>
    public ICollection<AlbumShare> SharedAlbums { get; set; } = new List<AlbumShare>();
}