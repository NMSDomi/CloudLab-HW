using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Models;
using cloudhw_BE.DAL.Repositories.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace cloudhw_BE.BLL.Services;

public class AlbumService(
    IAlbumRepository _albumRepo,
    IAlbumShareRepository _shareRepo,
    IPictureRepository _pictureRepo,
    UserManager<User> _userManager
    ) : IAlbumService
{
    public async Task<Album?> GetAlbumAsync(Guid id, string requestingUserId)
    {
        var album = await _albumRepo.GetByIdWithDetailsAsync(id);
        if (album == null) return null;

        if (!await HasAccessAsync(album, requestingUserId))
            return null;

        return album;
    }

    public async Task<int> GetPictureCountAsync(Guid albumId)
    {
        return await _albumRepo.GetPictureCountAsync(albumId);
    }

    public async Task<List<AlbumSummary>> GetMyAlbumsAsync(string userId)
    {
        return await _albumRepo.GetByOwnerIdAsync(userId);
    }

    public async Task<List<AlbumSummary>> GetPublicAlbumsAsync()
    {
        return await _albumRepo.GetPublicAlbumsAsync();
    }

    public async Task<List<AlbumSummary>> GetSharedWithMeAsync(string userId)
    {
        return await _albumRepo.GetSharedWithUserAsync(userId);
    }

    public async Task<List<AlbumSummary>> SearchAlbumsAsync(string query, string userId)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];
        return await _albumRepo.SearchAsync(query.Trim(), userId);
    }

    public async Task<Album> CreateAlbumAsync(string name, string? description, bool isPublic, string ownerId)
    {
        var album = new Album
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = description,
            IsPublic = isPublic,
            OwnerId = ownerId,
            CreatedAt = DateTime.UtcNow,
            Size = 0
        };

        return await _albumRepo.CreateAsync(album);
    }

    public async Task<Album?> UpdateAlbumAsync(Guid id, string name, string? description, bool isPublic, string ownerId)
    {
        var album = await _albumRepo.GetByIdAsync(id);
        if (album == null || album.OwnerId != ownerId)
            return null;

        album.Name = name;
        album.Description = description;
        album.IsPublic = isPublic;

        await _albumRepo.UpdateAsync(album);
        return album;
    }

    public async Task<bool> DeleteAlbumAsync(Guid id, string ownerId)
    {
        var album = await _albumRepo.GetByIdAsync(id);
        if (album == null || album.OwnerId != ownerId)
            return false;

        await _albumRepo.DeleteAsync(album);
        return true;
    }

    public async Task<bool> ShareAlbumAsync(Guid albumId, string targetUserId, string ownerId)
    {
        var album = await _albumRepo.GetByIdAsync(albumId);
        if (album == null || album.OwnerId != ownerId)
            return false;

        // Ensure the target user actually exists before creating the share record
        var targetUser = await _userManager.FindByIdAsync(targetUserId);
        if (targetUser == null)
            return false;

        if (await _shareRepo.IsSharedWithUserAsync(targetUserId, albumId))
            return true; // already shared

        var share = new AlbumShare
        {
            UserId = targetUserId,
            AlbumId = albumId,
            SharedAt = DateTime.UtcNow
        };

        await _shareRepo.AddAsync(share);
        return true;
    }

    public async Task<bool> UnshareAlbumAsync(Guid albumId, string targetUserId, string ownerId)
    {
        var album = await _albumRepo.GetByIdAsync(albumId);
        if (album == null || album.OwnerId != ownerId)
            return false;

        var share = await _shareRepo.GetAsync(targetUserId, albumId);
        if (share == null) return true; // already not shared

        await _shareRepo.RemoveAsync(share);
        return true;
    }

    public async Task<bool> SetCoverPictureAsync(Guid albumId, Guid pictureId, string ownerId)
    {
        var album = await _albumRepo.GetByIdAsync(albumId);
        if (album == null || album.OwnerId != ownerId)
            return false;

        // Verify the picture actually belongs to this album
        var pictures = await _albumRepo.GetPictureCountAsync(albumId);
        var picture = (await _pictureRepo.GetByAlbumIdAsync(albumId))
            .FirstOrDefault(p => p.Id == pictureId);
        if (picture == null)
            return false;

        album.CoverPictureId = pictureId;
        await _albumRepo.UpdateAsync(album);
        return true;
    }

    public async Task<bool> HasAccessAsync(Guid albumId, string userId)
    {
        var album = await _albumRepo.GetByIdAsync(albumId);
        if (album == null) return false;
        return await HasAccessAsync(album, userId);
    }

    private async Task<bool> HasAccessAsync(Album album, string userId)
    {
        if (album.OwnerId == userId) return true;
        if (album.IsPublic) return true;
        return await _shareRepo.IsSharedWithUserAsync(userId, album.Id);
    }
}
