namespace cloudhw_BE.DAL.Models;

public class Album
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public string? Description { get; set; }

    /// <summary>Total size in bytes of all pictures in the album.</summary>
    public long Size { get; set; }

    public bool IsPublic { get; set; }

    /// <summary>Optional cover picture for album listing.</summary>
    public Guid? CoverPictureId { get; set; }
    public Picture? CoverPicture { get; set; }

    // Owner
    public string OwnerId { get; set; } = null!;
    public User Owner { get; set; } = null!;

    // Navigation
    public ICollection<Picture> Pictures { get; set; } = new List<Picture>();

    /// <summary>Users this album is shared with (many-to-many).</summary>
    public ICollection<AlbumShare> SharedWith { get; set; } = new List<AlbumShare>();
}
