using cloudhw_BE.BLL.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace cloudhw_BE.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class PictureController(
    IPictureService _pictureService
    ) : ControllerBase
{
    [HttpGet("album/{albumId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAlbumPictures(Guid albumId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var pictures = await _pictureService.GetAlbumPicturesAsync(albumId, userId ?? string.Empty);
        return Ok(pictures.Select(p => new
        {
            p.Id,
            p.Name,
            p.CreatedAt,
            p.UploadedAt,
            p.Size,
            p.ContentType,
            p.Width,
            p.Height,
            p.AlbumId
        }));
    }

    [HttpGet("album/{albumId}/thumbnails")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAlbumThumbnails(Guid albumId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var pictures = await _pictureService.GetAlbumThumbnailsAsync(albumId, userId ?? string.Empty);
        return Ok(pictures.Select(p => new
        {
            p.Id,
            p.Name,
            p.CreatedAt,
            p.UploadedAt,
            p.Size,
            p.ContentType,
            p.Width,
            p.Height,
            p.AlbumId,
            Thumbnail = Convert.ToBase64String(p.Thumbnail)
        }));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPicture(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var picture = await _pictureService.GetPictureAsync(id, userId ?? string.Empty);
        if (picture == null) return NotFound();

        return Ok(new
        {
            picture.Id,
            picture.Name,
            picture.CreatedAt,
            picture.UploadedAt,
            picture.Size,
            picture.ContentType,
            picture.Width,
            picture.Height,
            picture.AlbumId
        });
    }

    [HttpGet("{id}/data")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPictureData(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var picture = await _pictureService.GetPictureAsync(id, userId ?? string.Empty);
        if (picture == null) return NotFound();

        // Guard against a stored ContentType that wasn't validated at upload time
        if (!AllowedContentTypes.Contains(picture.ContentType))
            return BadRequest("Invalid stored content type.");

        var safeName = Path.GetFileName(picture.Name);
        return File(picture.Data, picture.ContentType, safeName);
    }

    [HttpGet("{id}/thumbnail")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPictureThumbnail(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var picture = await _pictureService.GetThumbnailAsync(id, userId ?? string.Empty);
        if (picture == null) return NotFound();

        if (picture.Thumbnail == null || picture.Thumbnail.Length == 0)
            return NotFound();

        var safeName = Path.GetFileName(picture.Name);
        return File(picture.Thumbnail, "image/jpeg", $"thumb_{safeName}");
    }

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/tiff", "image/heic", "image/heif", "image/bmp"
    };

    [HttpPost("album/{albumId}")]
    [RequestSizeLimit(45_000_000)] // 45 MB max per upload
    public async Task<IActionResult> UploadPicture(Guid albumId, IFormFile file)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest("No file provided.");

        if (!AllowedContentTypes.Contains(file.ContentType))
            return BadRequest($"File type '{file.ContentType}' is not allowed. Only image files are accepted.");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var data = ms.ToArray();

        // Validate image and read dimensions
        int width = 0, height = 0;
        try
        {
            using var image = SixLabors.ImageSharp.Image.Load(data);
            width = image.Width;
            height = image.Height;
        }
        catch
        {
            return BadRequest("The uploaded file is not a valid image.");
        }

        var picture = await _pictureService.UploadPictureAsync(
            albumId,
            file.FileName,
            data,
            file.ContentType,
            width,
            height,
            userId
        );

        if (picture == null) return NotFound("Album not found or you don't own it.");

        return Ok(new
        {
            picture.Id,
            picture.Name,
            picture.CreatedAt,
            picture.UploadedAt,
            picture.Size,
            picture.ContentType,
            picture.Width,
            picture.Height,
            picture.AlbumId
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePicture(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var success = await _pictureService.DeletePictureAsync(id, userId);
        if (!success) return NotFound();

        return Ok();
    }
}
