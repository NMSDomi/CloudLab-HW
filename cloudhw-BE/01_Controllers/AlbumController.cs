using cloudhw_BE.BLL.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace cloudhw_BE.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class AlbumController(
    IAlbumService _albumService
    ) : ControllerBase
{
    public record CreateAlbumRequest(string Name, string? Description, bool IsPublic);
    public record UpdateAlbumRequest(string Name, string? Description, bool IsPublic);
    public record ShareAlbumRequest(string UserId);
    public record SetCoverRequest(Guid PictureId);

    [HttpGet("my")]
    public async Task<IActionResult> GetMyAlbums()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var albums = await _albumService.GetMyAlbumsAsync(userId);
        return Ok(albums);
    }

    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicAlbums()
    {
        var albums = await _albumService.GetPublicAlbumsAsync();
        return Ok(albums);
    }

    [HttpGet("shared")]
    public async Task<IActionResult> GetSharedWithMe()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var albums = await _albumService.GetSharedWithMeAsync(userId);
        return Ok(albums);
    }

    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());

        var results = await _albumService.SearchAlbumsAsync(q, userId ?? string.Empty);
        return Ok(results);
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAlbum(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var album = await _albumService.GetAlbumAsync(id, userId ?? string.Empty);
        if (album == null) return NotFound();

        var pictureCount = await _albumService.GetPictureCountAsync(id);

        // Only expose share recipients to authenticated users (owner / share target)
        var isAuthenticated = !string.IsNullOrEmpty(userId);

        return Ok(new
        {
            album.Id,
            album.Name,
            album.Description,
            album.CreatedAt,
            album.Size,
            album.IsPublic,
            album.OwnerId,
            OwnerName = album.Owner?.Name,
            PictureCount = pictureCount,
            CoverPictureId = album.CoverPictureId,
            SharedWith = isAuthenticated
                ? album.SharedWith.Select(s => new
                {
                    s.UserId,
                    UserName = s.User?.Name,
                    s.SharedAt
                })
                : Enumerable.Empty<object>()
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateAlbum([FromBody] CreateAlbumRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var album = await _albumService.CreateAlbumAsync(request.Name, request.Description, request.IsPublic, userId);
        return Ok(MapAlbum(album));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAlbum(Guid id, [FromBody] UpdateAlbumRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var album = await _albumService.UpdateAlbumAsync(id, request.Name, request.Description, request.IsPublic, userId);
        if (album == null) return NotFound();

        return Ok(MapAlbum(album));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAlbum(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var success = await _albumService.DeleteAlbumAsync(id, userId);
        if (!success) return NotFound();

        return Ok();
    }

    [HttpPost("{id}/share")]
    public async Task<IActionResult> ShareAlbum(Guid id, [FromBody] ShareAlbumRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var success = await _albumService.ShareAlbumAsync(id, request.UserId, userId);
        if (!success) return NotFound();

        return Ok();
    }

    [HttpDelete("{id}/share/{targetUserId}")]
    public async Task<IActionResult> UnshareAlbum(Guid id, string targetUserId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var success = await _albumService.UnshareAlbumAsync(id, targetUserId, userId);
        if (!success) return NotFound();

        return Ok();
    }

    [HttpPut("{id}/cover")]
    public async Task<IActionResult> SetCoverPicture(Guid id, [FromBody] SetCoverRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var success = await _albumService.SetCoverPictureAsync(id, request.PictureId, userId);
        if (!success) return NotFound();

        return Ok();
    }

    [HttpGet("{id}/cover")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCoverThumbnail(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var album = await _albumService.GetAlbumAsync(id, userId ?? string.Empty);
        if (album == null) return NotFound();

        if (album.CoverPictureId == null || album.CoverPicture == null)
            return NoContent();

        var cover = album.CoverPicture;
        if (cover.Thumbnail.Length > 0)
            return File(cover.Thumbnail, "image/jpeg", $"cover_{cover.Name}");

        return File(cover.Data, cover.ContentType, cover.Name);
    }

    private static object MapAlbum(DAL.Models.Album a) => new
    {
        a.Id,
        a.Name,
        a.Description,
        a.CreatedAt,
        a.Size,
        a.IsPublic,
        a.OwnerId,
        OwnerName = a.Owner?.Name,
        PictureCount = a.Pictures.Count,
        a.CoverPictureId
    };
}
