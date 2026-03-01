namespace cloudhw_BE.DAL.Models;

/// <summary>
/// Join entity for the many-to-many relationship between Users and Albums
/// they have been granted access to (shared albums).
/// </summary>
public class AlbumShare
{
    public string UserId { get; set; } = null!;
    public User User { get; set; } = null!;

    public Guid AlbumId { get; set; }
    public Album Album { get; set; } = null!;

    /// <summary>When the album was shared with this user.</summary>
    public DateTime SharedAt { get; set; }
}
