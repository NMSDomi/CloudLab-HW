using cloudhw_BE.BLL.Services;
using cloudhw_BE.BLL.Services.Interfaces;

namespace cloudhw_BE.Setup;

public static class ServicesSetup
{
    public static void SetupServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<IAuthService, AuthService>();

    }
}
