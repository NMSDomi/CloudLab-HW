using cloudhw_BE.DAL.Models;

namespace cloudhw_BE.BLL.Services.Interfaces;

public interface IAlbumService
{
    Task<Album?> GetAlbumAsync(Guid id, string requestingUserId);
    Task<int> GetPictureCountAsync(Guid albumId);
    Task<List<AlbumSummary>> GetMyAlbumsAsync(string userId);
    Task<List<AlbumSummary>> GetPublicAlbumsAsync();
    Task<List<AlbumSummary>> GetSharedWithMeAsync(string userId);
    Task<List<AlbumSummary>> SearchAlbumsAsync(string query, string userId);
    Task<Album> CreateAlbumAsync(string name, string? description, bool isPublic, string ownerId);
    Task<Album?> UpdateAlbumAsync(Guid id, string name, string? description, bool isPublic, string ownerId);
    Task<bool> DeleteAlbumAsync(Guid id, string ownerId);
    Task<bool> ShareAlbumAsync(Guid albumId, string targetUserId, string ownerId);
    Task<bool> UnshareAlbumAsync(Guid albumId, string targetUserId, string ownerId);
    Task<bool> SetCoverPictureAsync(Guid albumId, Guid pictureId, string ownerId);
    Task<bool> HasAccessAsync(Guid albumId, string userId);
}
