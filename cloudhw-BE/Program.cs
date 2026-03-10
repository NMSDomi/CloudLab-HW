using Backend.Setup;
using cloudhw_BE.DAL.Context;
using cloudhw_BE.Setup;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ISystemContext, SystemContext>();

builder.Services.AddControllers();

builder.SetupAuth();
builder.SetupSwagger();
builder.SetupServices();
builder.SetupDatabase();
builder.SetupCors();
builder.SetupRateLimiting();

var app = builder.Build();

// Run migrations in background so the HTTP server starts immediately
// and App Engine Flex health checks can pass without timing out
_ = Task.Run(async () =>
{
    await app.ApplyMigrationsAsync();
    await app.UseRoleSeedAsync();
});

app.ConfigureSwagger();
app.ConfigureCors();
app.UseRateLimiter();

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

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();