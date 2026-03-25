using Backend.Setup;
using cloudhw_BE.DAL.Context;
using cloudhw_BE.Setup;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ISystemContext, SystemContext>();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

builder.SetupAuth();
builder.SetupSwagger();
builder.SetupServices();
builder.SetupDatabase();
builder.SetupCors();
// builder.SetupRateLimiting(); // Disabled for load testing

var app = builder.Build();

// Run migrations in background so the HTTP server starts immediately
// and App Engine Flex health checks can pass without timing out
_ = Task.Run(async () =>
{
    var startupLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    try
    {
        await app.ApplyMigrationsAsync();
    }
    catch (Exception ex)
    {
        startupLogger.LogCritical(ex, "Migration failed");
        return;
    }

    try
    {
        await app.UseRoleSeedAsync();
    }
    catch (Exception ex)
    {
        startupLogger.LogCritical(ex, "Role/user seed failed");
    }
});

app.ConfigureSwagger();
app.ConfigureCors();
// app.UseRateLimiter(); // Disabled for load testing

// Security response headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none';";
    await next();
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();