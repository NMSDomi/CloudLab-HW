using cloudhw_BE.DAL.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace cloudhw_BE.Setup;

public static class DatabaseSetup
{
    public static void SetupDatabase(this WebApplicationBuilder builder)
    {
        builder.Services.AddDbContext<DataContext>(options =>
        {
            options.UseLoggerFactory(LoggerFactory.Create(builder =>
            {
                builder
                    .AddConsole()
                    .SetMinimumLevel(LogLevel.Error);
            }));
        });
    }

    // Run pending migrations and create DB if it does not exist
    public static async Task ApplyMigrationsAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DataContext>();
        await db.Database.MigrateAsync();
    }
}
