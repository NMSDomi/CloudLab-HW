using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using cloudhw_BE.DAL.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace cloudhw_BE.DAL.Repositories;

public class AlbumShareRepository(DataContext _context) : IAlbumShareRepository
{
    public async Task<AlbumShare?> GetAsync(string userId, Guid albumId)
    {
        return await _context.AlbumShares
            .FirstOrDefaultAsync(s => s.UserId == userId && s.AlbumId == albumId);
    }

    public async Task<List<AlbumShare>> GetByAlbumIdAsync(Guid albumId)
    {
        return await _context.AlbumShares
            .Where(s => s.AlbumId == albumId)
            .Include(s => s.User)
            .ToListAsync();
    }

    public async Task<bool> IsSharedWithUserAsync(string userId, Guid albumId)
    {
        return await _context.AlbumShares
            .AnyAsync(s => s.UserId == userId && s.AlbumId == albumId);
    }

    public async Task AddAsync(AlbumShare share)
    {
        _context.AlbumShares.Add(share);
        await _context.SaveChangesAsync();
    }

    public async Task RemoveAsync(AlbumShare share)
    {
        _context.AlbumShares.Remove(share);
        await _context.SaveChangesAsync();
    }
}
