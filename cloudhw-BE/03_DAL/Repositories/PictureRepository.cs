using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using cloudhw_BE.DAL.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace cloudhw_BE.DAL.Repositories;

public class PictureRepository(DataContext _context) : IPictureRepository
{
    public async Task<Picture?> GetByIdAsync(Guid id)
    {
        return await _context.Pictures.FindAsync(id);
    }

    public async Task<Picture?> GetThumbnailByIdAsync(Guid id)
    {
        return await _context.Pictures
            .Where(p => p.Id == id)
            .Select(p => new Picture
            {
                Id = p.Id,
                Name = p.Name,
                ContentType = p.ContentType,
                Thumbnail = p.Thumbnail,
                AlbumId = p.AlbumId
            })
            .FirstOrDefaultAsync();
    }

    public async Task<List<Picture>> GetByAlbumIdAsync(Guid albumId)
    {
        return await _context.Pictures
            .Where(p => p.AlbumId == albumId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new Picture
            {
                Id = p.Id,
                Name = p.Name,
                CreatedAt = p.CreatedAt,
                UploadedAt = p.UploadedAt,
                Size = p.Size,
                ContentType = p.ContentType,
                Width = p.Width,
                Height = p.Height,
                AlbumId = p.AlbumId
            })
            .ToListAsync();
    }

    public async Task<List<Picture>> GetThumbnailsByAlbumIdAsync(Guid albumId)
    {
        return await _context.Pictures
            .Where(p => p.AlbumId == albumId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new Picture
            {
                Id = p.Id,
                Name = p.Name,
                CreatedAt = p.CreatedAt,
                UploadedAt = p.UploadedAt,
                Size = p.Size,
                ContentType = p.ContentType,
                Thumbnail = p.Thumbnail,
                Width = p.Width,
                Height = p.Height,
                AlbumId = p.AlbumId
            })
            .ToListAsync();
    }

    public async Task<Picture> CreateAsync(Picture picture)
    {
        _context.Pictures.Add(picture);
        await _context.SaveChangesAsync();
        return picture;
    }

    public async Task DeleteAsync(Picture picture)
    {
        _context.Pictures.Remove(picture);
        await _context.SaveChangesAsync();
    }
}
