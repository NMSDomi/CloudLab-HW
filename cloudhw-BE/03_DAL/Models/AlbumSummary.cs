namespace cloudhw_BE.DAL.Models;

public record AlbumSummary(
    Guid Id,
    string Name,
    string? Description,
    DateTime CreatedAt,
    long Size,
    bool IsPublic,
    string OwnerId,
    string? OwnerName,
    int PictureCount,
    Guid? CoverPictureId
);
