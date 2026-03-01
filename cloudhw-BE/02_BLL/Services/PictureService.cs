using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Models;
using cloudhw_BE.DAL.Repositories.Interfaces;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace cloudhw_BE.BLL.Services;

public class PictureService(
    IPictureRepository _pictureRepo,
    IAlbumRepository _albumRepo,
    IAlbumService _albumService
    ) : IPictureService
{
    public async Task<Picture?> GetPictureAsync(Guid id, string requestingUserId)
    {
        var picture = await _pictureRepo.GetByIdAsync(id);
        if (picture == null) return null;

        if (!await _albumService.HasAccessAsync(picture.AlbumId, requestingUserId))
            return null;

        return picture;
    }

    public async Task<Picture?> GetThumbnailAsync(Guid id, string requestingUserId)
    {
        var picture = await _pictureRepo.GetThumbnailByIdAsync(id);
        if (picture == null) return null;

        if (!await _albumService.HasAccessAsync(picture.AlbumId, requestingUserId))
            return null;

        return picture;
    }

    public async Task<List<Picture>> GetAlbumPicturesAsync(Guid albumId, string requestingUserId)
    {
        if (!await _albumService.HasAccessAsync(albumId, requestingUserId))
            return new List<Picture>();

        return await _pictureRepo.GetByAlbumIdAsync(albumId);
    }

    public async Task<List<Picture>> GetAlbumThumbnailsAsync(Guid albumId, string requestingUserId)
    {
        if (!await _albumService.HasAccessAsync(albumId, requestingUserId))
            return new List<Picture>();

        return await _pictureRepo.GetThumbnailsByAlbumIdAsync(albumId);
    }

    public async Task<Picture?> UploadPictureAsync(Guid albumId, string name, byte[] data, string contentType, int width, int height, string ownerId)
    {
        var album = await _albumRepo.GetByIdAsync(albumId);
        if (album == null || album.OwnerId != ownerId)
            return null;

        var picture = new Picture
        {
            Id = Guid.NewGuid(),
            Name = name,
            CreatedAt = new DateTime(
                DateTime.UtcNow.Year, DateTime.UtcNow.Month, DateTime.UtcNow.Day,
                DateTime.UtcNow.Hour, DateTime.UtcNow.Minute, 0, DateTimeKind.Utc),
            Size = data.Length,
            ContentType = contentType,
            Data = data,
            Thumbnail = GenerateThumbnail(data),
            Width = width,
            Height = height,
            AlbumId = albumId
        };

        var created = await _pictureRepo.CreateAsync(picture);

        // Update album size
        album.Size += data.Length;
        await _albumRepo.UpdateAsync(album);

        return created;
    }

    public async Task<bool> DeletePictureAsync(Guid id, string ownerId)
    {
        var picture = await _pictureRepo.GetByIdAsync(id);
        if (picture == null) return false;

        var album = await _albumRepo.GetByIdAsync(picture.AlbumId);
        if (album == null || album.OwnerId != ownerId)
            return false;

        await _pictureRepo.DeleteAsync(picture);

        // Update album size
        album.Size -= picture.Size;
        if (album.Size < 0) album.Size = 0;
        await _albumRepo.UpdateAsync(album);

        return true;
    }

    private static byte[] GenerateThumbnail(byte[] originalData, int maxSize = 500)
    {
        try
        {
            using var image = Image.Load(originalData);
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(maxSize, maxSize),
                Mode = ResizeMode.Max
            }));

            using var ms = new MemoryStream();
            image.Save(ms, new JpegEncoder { Quality = 90 });
            return ms.ToArray();
        }
        catch
        {
            return Array.Empty<byte>();
        }
    }
}
