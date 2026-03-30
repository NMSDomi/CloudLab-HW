using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace cloudhw_BE.DAL.Context;

/// <summary>
/// Used only by EF Core tools (dotnet ef migrations add/update) at design time.
/// Bypasses the real SystemContext validation so migrations can be generated
/// without requiring environment variables to be set.
/// </summary>
public class DataContextFactory : IDesignTimeDbContextFactory<DataContext>
{
    public DataContext CreateDbContext(string[] args)
    {
        var systemContext = new DesignTimeSystemContext();
        var optionsBuilder = new DbContextOptionsBuilder<DataContext>();
        optionsBuilder.UseNpgsql(systemContext.GetConnectionString());
        return new DataContext(optionsBuilder.Options, systemContext);
    }
}

/// <summary>
/// Minimal ISystemContext used only at design time — no validation, no real secrets.
/// </summary>
file class DesignTimeSystemContext : ISystemContext
{
    public string POSTGRES_HOST { get; set; } = Env("POSTGRES_HOST", "localhost");
    public string POSTGRES_PORT { get; set; } = Env("POSTGRES_PORT", "5432");
    public string POSTGRES_USER { get; set; } = Env("POSTGRES_USER", "design");
    public string POSTGRES_PASSWORD { get; set; } = Env("POSTGRES_PASSWORD", "design");
    public string POSTGRES_DB { get; set; } = Env("POSTGRES_DB", "design");

    private static string Env(string key, string fallback) =>
        Environment.GetEnvironmentVariable(key) is { Length: > 0 } v ? v : fallback;
    public string JWT_ISSUER { get; set; } = "";
    public string JWT_AUDIANCE { get; set; } = "";
    public string JWT_KEY { get; set; } = "";
    public string ADMIN_EMAIL { get; set; } = "";
    public string ADMIN_PASSWORD { get; set; } = "";
    public string ADMIN_NAME { get; set; } = "";
    public string SMTP_HOST { get; set; } = "";
    public string SMTP_PORT { get; set; } = "";
    public string SMTP_USER { get; set; } = "";
    public string SMTP_PASSWORD { get; set; } = "";
    public string SMTP_FROM { get; set; } = "";
    public string FRONTEND_URL { get; set; } = "";

    public string GetConnectionString() =>
        $"Host={POSTGRES_HOST};Port={POSTGRES_PORT};Username={POSTGRES_USER};Password={POSTGRES_PASSWORD};Database={POSTGRES_DB}";
}
