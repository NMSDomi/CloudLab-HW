using cloudhw_BE.DAL.Models;

namespace cloudhw_BE.DAL.Repositories.Interfaces;

public interface IAlbumRepository
{
    Task<Album?> GetByIdAsync(Guid id);
    Task<Album?> GetByIdWithDetailsAsync(Guid id);
    Task<int> GetPictureCountAsync(Guid albumId);
    Task<List<AlbumSummary>> GetByOwnerIdAsync(string userId);
    Task<List<AlbumSummary>> GetPublicAlbumsAsync();
    Task<List<AlbumSummary>> GetSharedWithUserAsync(string userId);
    Task<Album> CreateAsync(Album album);
    Task UpdateAsync(Album album);
    Task DeleteAsync(Album album);
}
