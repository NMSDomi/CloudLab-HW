namespace cloudhw_BE.DAL.Models;

public class Picture
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Stored with precision to the minute (no seconds).</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>File size in bytes.</summary>
    public long Size { get; set; }

    /// <summary>MIME type, e.g. image/jpeg.</summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Raw image bytes stored as a PostgreSQL bytea column.</summary>
    public byte[] Data { get; set; } = Array.Empty<byte>();

    /// <summary>Smaller preview image (JPEG, max 300px on longest side).</summary>
    public byte[] Thumbnail { get; set; } = Array.Empty<byte>();

    public int Width { get; set; }
    public int Height { get; set; }

    // Album FK
    public Guid AlbumId { get; set; }
    public Album Album { get; set; } = null!;
}
