using cloudhw_BE.DAL.Models;

namespace cloudhw_BE.BLL.Services.Interfaces;

public interface IPictureService
{
    Task<Picture?> GetPictureAsync(Guid id, string requestingUserId);
    Task<Picture?> GetThumbnailAsync(Guid id, string requestingUserId);
    Task<List<Picture>> GetAlbumPicturesAsync(Guid albumId, string requestingUserId);
    Task<List<Picture>> GetAlbumThumbnailsAsync(Guid albumId, string requestingUserId);
    Task<Picture?> UploadPictureAsync(Guid albumId, string name, byte[] data, string contentType, int width, int height, string ownerId);
    Task<bool> DeletePictureAsync(Guid id, string ownerId);
}
