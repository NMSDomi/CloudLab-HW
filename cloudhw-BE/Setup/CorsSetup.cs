namespace cloudhw_BE.Setup;

public static class CorsSetup
{
    private static readonly string CorsPolicy = "cors";

    public static void SetupCors(this WebApplicationBuilder builder)
    {
        builder.Services.AddCors(options =>
        {
            options.AddPolicy(name: CorsPolicy,
                policy =>
                {
                    policy.WithOrigins
                            (
                             "http://localhost:4200",
                             "https://localhost:4200",
                             "http://localhost:4400",
                             "https://localhost:4400",
                             "http://localhost:82",
                             "https://localhost:82"
                            )
                            .AllowAnyHeader()
                            .AllowAnyMethod()
                            .AllowCredentials();
                });
        });
    }

    public static void ConfigureCors(this WebApplication app)
    {
        app.UseCors(CorsPolicy);
    }
}
