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
                    var allowedOrigins = new List<string>();

                    // Localhost origins only in Development
                    if (builder.Environment.IsDevelopment())
                    {
                        allowedOrigins.AddRange(new[]
                        {
                            "http://localhost:4200",
                            "https://localhost:4200",
                            "http://localhost:4400",
                            "https://localhost:4400",
                            "http://localhost:82",
                            "https://localhost:82"
                        });
                    }

                    // Add production frontend URL from environment variable
                    var frontendUrl = builder.Configuration["FRONTEND_URL"];
                    if (!string.IsNullOrWhiteSpace(frontendUrl))
                    {
                        allowedOrigins.Add(frontendUrl);
                    }

                    policy.WithOrigins(allowedOrigins.ToArray())
                            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                            .AllowAnyHeader()
                            .AllowCredentials();
                });
        });
    }

    public static void ConfigureCors(this WebApplication app)
    {
        app.UseCors(CorsPolicy);
    }
}
