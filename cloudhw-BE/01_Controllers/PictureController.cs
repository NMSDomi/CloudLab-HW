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
    public async Task<IActionResult> GetAlbumPictures(Guid albumId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var pictures = await _pictureService.GetAlbumPicturesAsync(albumId, userId);
        return Ok(pictures.Select(p => new
        {
            p.Id,
            p.Name,
            p.CreatedAt,
            p.Size,
            p.ContentType,
            p.Width,
            p.Height,
            p.AlbumId,
            p.Thumbnail
        }));
    }

    [HttpGet("album/{albumId}/thumbnails")]
    public async Task<IActionResult> GetAlbumThumbnails(Guid albumId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var pictures = await _pictureService.GetAlbumThumbnailsAsync(albumId, userId);
        return Ok(pictures.Select(p => new
        {
            p.Id,
            p.Name,
            p.CreatedAt,
            p.Size,
            p.ContentType,
            p.Width,
            p.Height,
            p.AlbumId,
            Thumbnail = Convert.ToBase64String(p.Thumbnail)
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPicture(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var picture = await _pictureService.GetPictureAsync(id, userId);
        if (picture == null) return NotFound();

        return Ok(new
        {
            picture.Id,
            picture.Name,
            picture.CreatedAt,
            picture.Size,
            picture.ContentType,
            picture.Width,
            picture.Height,
            picture.AlbumId
        });
    }

    [HttpGet("{id}/data")]
    public async Task<IActionResult> GetPictureData(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var picture = await _pictureService.GetPictureAsync(id, userId);
        if (picture == null) return NotFound();

        return File(picture.Data, picture.ContentType, picture.Name);
    }

    [HttpGet("{id}/thumbnail")]
    public async Task<IActionResult> GetPictureThumbnail(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var picture = await _pictureService.GetThumbnailAsync(id, userId);
        if (picture == null) return NotFound();

        if (picture.Thumbnail == null || picture.Thumbnail.Length == 0)
            return NotFound();

        return File(picture.Thumbnail, "image/jpeg", $"thumb_{picture.Name}");
    }

    [HttpPost("album/{albumId}")]
    public async Task<IActionResult> UploadPicture(Guid albumId, IFormFile file)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest("No file provided.");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var data = ms.ToArray();

        // Try to read image dimensions
        int width = 0, height = 0;
        try
        {
            using var image = SixLabors.ImageSharp.Image.Load(data);
            width = image.Width;
            height = image.Height;
        }
        catch
        {
            // Not a valid image or unsupported format — keep 0x0
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
