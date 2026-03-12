namespace cloudhw_BE.Controllers.DTOs;

public record CreateAlbumRequest(string Name, string? Description, bool IsPublic);
public record UpdateAlbumRequest(string Name, string? Description, bool IsPublic);
public record ShareAlbumRequest(string UserId);
public record SetCoverRequest(Guid PictureId);
public record RenamePictureRequest(string Name);
