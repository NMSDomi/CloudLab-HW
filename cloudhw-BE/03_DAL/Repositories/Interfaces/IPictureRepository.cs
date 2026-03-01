using cloudhw_BE.DAL.Models;

namespace cloudhw_BE.DAL.Repositories.Interfaces;

public interface IPictureRepository
{
    Task<Picture?> GetByIdAsync(Guid id);
    /// <summary>Returns a picture with only thumbnail bytes (no full Data).</summary>
    Task<Picture?> GetThumbnailByIdAsync(Guid id);
    Task<List<Picture>> GetByAlbumIdAsync(Guid albumId);
    /// <summary>Returns pictures for an album with only thumbnail bytes (no full Data).</summary>
    Task<List<Picture>> GetThumbnailsByAlbumIdAsync(Guid albumId);
    Task<Picture> CreateAsync(Picture picture);
    Task DeleteAsync(Picture picture);
}
