using cloudhw_BE.BLL.Services;
using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Repositories;
using cloudhw_BE.DAL.Repositories.Interfaces;

namespace cloudhw_BE.Setup;

public static class ServicesSetup
{
    public static void SetupServices(this WebApplicationBuilder builder)
    {
        // Repositories
        builder.Services.AddScoped<IAlbumRepository, AlbumRepository>();
        builder.Services.AddScoped<IPictureRepository, PictureRepository>();
        builder.Services.AddScoped<IAlbumShareRepository, AlbumShareRepository>();

        // Services
        builder.Services.AddScoped<IAuthService, AuthService>();
        builder.Services.AddScoped<IAlbumService, AlbumService>();
        builder.Services.AddScoped<IPictureService, PictureService>();
    }
}
