using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using cloudhw_BE.DAL.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace cloudhw_BE.DAL.Repositories;

public class AlbumRepository(DataContext _context) : IAlbumRepository
{
    public async Task<Album?> GetByIdAsync(Guid id)
    {
        return await _context.Albums.FindAsync(id);
    }

    public async Task<Album?> GetByIdWithDetailsAsync(Guid id)
    {
        return await _context.Albums
            .Include(a => a.SharedWith)
                .ThenInclude(s => s.User)
            .Include(a => a.Owner)
            .FirstOrDefaultAsync(a => a.Id == id);
    }

    public async Task<int> GetPictureCountAsync(Guid albumId)
    {
        return await _context.Pictures.CountAsync(p => p.AlbumId == albumId);
    }

    public async Task<List<AlbumSummary>> GetByOwnerIdAsync(string userId)
    {
        return await _context.Albums
            .Where(a => a.OwnerId == userId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AlbumSummary(
                a.Id, a.Name, a.Description, a.CreatedAt, a.Size,
                a.IsPublic, a.OwnerId, a.Owner.Name,
                a.Pictures.Count, a.CoverPictureId
            ))
            .ToListAsync();
    }

    public async Task<List<AlbumSummary>> GetPublicAlbumsAsync()
    {
        return await _context.Albums
            .Where(a => a.IsPublic)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AlbumSummary(
                a.Id, a.Name, a.Description, a.CreatedAt, a.Size,
                a.IsPublic, a.OwnerId, a.Owner.Name,
                a.Pictures.Count, a.CoverPictureId
            ))
            .ToListAsync();
    }

    public async Task<List<AlbumSummary>> GetSharedWithUserAsync(string userId)
    {
        return await _context.AlbumShares
            .Where(s => s.UserId == userId)
            .Select(s => s.Album)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AlbumSummary(
                a.Id, a.Name, a.Description, a.CreatedAt, a.Size,
                a.IsPublic, a.OwnerId, a.Owner.Name,
                a.Pictures.Count, a.CoverPictureId
            ))
            .ToListAsync();
    }

    public async Task<List<AlbumSummary>> SearchAsync(string query, string userId)
    {
        var q = query.ToLower();
        return await _context.Albums
            .Where(a =>
                (a.OwnerId == userId || a.IsPublic || a.SharedWith.Any(s => s.UserId == userId)) &&
                (a.Name.ToLower().Contains(q) || (a.Owner.Name != null && a.Owner.Name.ToLower().Contains(q)))
            )
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AlbumSummary(
                a.Id, a.Name, a.Description, a.CreatedAt, a.Size,
                a.IsPublic, a.OwnerId, a.Owner.Name,
                a.Pictures.Count, a.CoverPictureId
            ))
            .Take(20)
            .ToListAsync();
    }

    public async Task<Album> CreateAsync(Album album)
    {
        _context.Albums.Add(album);
        await _context.SaveChangesAsync();
        return album;
    }

    public async Task UpdateAsync(Album album)
    {
        _context.Albums.Update(album);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Album album)
    {
        _context.Albums.Remove(album);
        await _context.SaveChangesAsync();
    }
}
