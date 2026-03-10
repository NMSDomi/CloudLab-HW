using cloudhw_BE.DAL.Context;
using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

namespace cloudhw_BE.Setup;

public static class AuthSetup
{
    public static void SetupAuth(this WebApplicationBuilder builder)
    {
        //Authentications
        builder.Services.AddIdentity<User, IdentityRole>(options =>
        {
            // Password complexity
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Password.RequireUppercase = true;
            options.Password.RequiredLength = 8;

            // Account lockout after failed attempts
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
        })
            .AddRoles<IdentityRole>()
            .AddTokenProvider<DataProtectorTokenProvider<User>>("cloudhwBackendApi")
            .AddEntityFrameworkStores<DataContext>()
            .AddDefaultTokenProviders();

        builder.Services.Configure<IdentityOptions>(options =>
        {
            options.SignIn.RequireConfirmedEmail = true;
            options.User.RequireUniqueEmail = true;
        });

        // Password reset / email confirmation tokens expire after 1 hour
        builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
        {
            options.TokenLifespan = TimeSpan.FromMinutes(5);
        });

        
        var systemContext = builder.Services.BuildServiceProvider().GetRequiredService<ISystemContext>();

        //JWT
        builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;

        }).AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                ValidateIssuer = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,
                RoleClaimType = ClaimTypes.Role,
                ValidIssuer = systemContext.JWT_ISSUER,
                ValidAudience = systemContext.JWT_AUDIANCE,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(systemContext.JWT_KEY))
            };
        });
    }
}
