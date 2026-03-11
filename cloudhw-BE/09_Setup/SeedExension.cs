using cloudhw_BE.BLL.Seed;
using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Identity;

namespace cloudhw_BE.Setup;

public static class SeedExtensions
{
    public static async Task UseRoleSeedAsync(this IApplicationBuilder app)
    {
        using var scope = app.ApplicationServices.CreateScope();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var systemContext = scope.ServiceProvider.GetRequiredService<ISystemContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<RoleSeed>>();

        var roleSeed = new RoleSeed(roleManager, userManager, systemContext, logger);
        await roleSeed.InstallAsync();
    }
}
