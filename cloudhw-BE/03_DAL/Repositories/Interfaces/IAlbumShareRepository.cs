using cloudhw_BE.DAL.Models;

namespace cloudhw_BE.DAL.Repositories.Interfaces;

public interface IAlbumShareRepository
{
    Task<AlbumShare?> GetAsync(string userId, Guid albumId);
    Task<List<AlbumShare>> GetByAlbumIdAsync(Guid albumId);
    Task<bool> IsSharedWithUserAsync(string userId, Guid albumId);
    Task AddAsync(AlbumShare share);
    Task RemoveAsync(AlbumShare share);
}
