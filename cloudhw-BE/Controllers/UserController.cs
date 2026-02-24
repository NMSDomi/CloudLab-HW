using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace cloudhw_BE.Controllers;
[Route("api/[controller]")]
[ApiController]
public class UserController(
    UserManager<User> _userManager,
    SignInManager<User> _signInManager,
    IAuthService _authService
    ) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest model)
    {
        var (success, message, user, jwt, refreshToken) = await _authService.ValidateUserAndGenerateTokensAsync(model.Email, model.Password, _signInManager);
        if (!success)
        {
            return Unauthorized(new { message });
        }

        return Ok(new
        {
            token = new JwtSecurityTokenHandler().WriteToken(jwt!),
            refreshToken,
            expires = jwt!.ValidTo
        });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        await _userManager.UpdateAsync(user);

        return Ok();
    }

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] DAL.Models.RefreshRequest request)
    {
        try
        {
            var result = await _authService.RefreshTokenAsync(request.Token, request.RefreshToken);
            return Ok(new
            {
                token = result.AccessToken,
                refreshToken = result.RefreshToken,
                expires = result.Expires
            });
        }
        catch (SecurityTokenException ex)
        {
            return Unauthorized(ex.Message);
        }
    }


    [HttpGet("all")]
    [Authorize(Roles = $"{RoleNames.Admin}")]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await _userManager.Users.ToListAsync();
        var usersWithRoles = new List<object>();

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            usersWithRoles.Add(new
            {
                user.Id,
                user.Email,
                user.Name,
                user.UserName,
                Roles = roles.FirstOrDefault()
            });
        }

        return Ok(usersWithRoles);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetUserById(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new
        {
            user.Id,
            user.Email,
            user.Name,
            user.UserName,
            Roles = roles.FirstOrDefault()
        });
    }


    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new
        {
            user.Id,
            user.Email,
            user.Name,
            user.UserName,
            Roles = roles.FirstOrDefault()
        });
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateOwnProfile([FromBody] UpdateProfileRequest model)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId);

        if (user == null) return NotFound();

        user.Name = model.Name;
        user.UserName = model.Email;
        user.Email = model.Email;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok();
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] DAL.Models.RegisterRequest model)
    {
        var user = new User
        {
            UserName = model.Email,
            Email = model.Email,
            Name = model.Name
        };

        var result = await _userManager.CreateAsync(user, model.Password);

        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await _userManager.AddToRoleAsync(user, RoleNames.Editor);

        return Ok(new { message = "Sikeres regisztráció.", user.Email });
    }


    [HttpPut("role/{id}")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> UpdateUserRole(string id, [FromBody] UpdateRoleRequest model)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound("Felhasználó nem található.");

        var currentRoles = await _userManager.GetRolesAsync(user);
        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
        if (!removeResult.Succeeded) return BadRequest("Nem sikerült a jelenlegi szerepeket eltávolítani.");

        var addResult = await _userManager.AddToRoleAsync(user, model.Role);
        if (!addResult.Succeeded) return BadRequest("Nem sikerült az új szerepkört beállítani.");

        return Ok();
    }

    [HttpPost("reset-password")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest model)
    {
        var success = await _authService.ResetUserPasswordAsync(model.Email, model.NewPassword);
        if (!success)
            return NotFound("Felhasználó nem található vagy a jelszó módosítás sikertelen.");

        return Ok();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest model)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);

        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        return Ok();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> Delete(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok();
    }
}