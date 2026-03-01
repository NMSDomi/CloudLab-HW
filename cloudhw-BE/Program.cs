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
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();