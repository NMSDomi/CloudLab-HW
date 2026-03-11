using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Identity;

namespace cloudhw_BE.BLL.Seed;

public class RoleSeed(
    RoleManager<IdentityRole> _roleManager,
    UserManager<User> _userManager,
    ISystemContext _systemContext,
    ILogger<RoleSeed> _logger
    )
{
    public async Task InstallAsync()
    {
        await InstallNonExistingRoles();
        await InstallNonExistingUsers();
    }

    private async Task InstallNonExistingRoles()
    {
        var roles = new[] { RoleNames.Admin, RoleNames.Editor };
        foreach (var role in roles)
        {
            if (!await _roleManager.RoleExistsAsync(role))
                await _roleManager.CreateAsync(new IdentityRole(role));
        }
    }

    private async Task InstallNonExistingUsers()
    {
        // Admin user létrehozása
        var admin = await _userManager.FindByEmailAsync(_systemContext.ADMIN_EMAIL);
        if (admin == null)
        {
            var user = new User
            {
                UserName = _systemContext.ADMIN_EMAIL,
                Email = _systemContext.ADMIN_EMAIL,
                Name = _systemContext.ADMIN_NAME,
                EmailConfirmed = true
            };

            var result = await _userManager.CreateAsync(user, _systemContext.ADMIN_PASSWORD);
            if (result.Succeeded)
            {
                await _userManager.AddToRoleAsync(user, RoleNames.Admin);
                _logger.LogInformation("Admin user created: {Email}", _systemContext.ADMIN_EMAIL);
            }
            else
            {
                _logger.LogCritical("Admin user creation failed: {Errors}",
                    string.Join(", ", result.Errors.Select(e => $"{e.Code}: {e.Description}")));
            }
        }
        else
        {
            _logger.LogInformation("Admin user already exists: {Email}", _systemContext.ADMIN_EMAIL);
        }
    }
}
