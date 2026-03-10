using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace cloudhw_BE.Setup;

public static class RateLimitSetup
{
    /// <summary>Policy name for sensitive auth endpoints (login, register, password reset…)</summary>
    public const string AuthPolicy = "auth";

    /// <summary>Policy name for general API endpoints.</summary>
    public const string GeneralPolicy = "general";

    public static void SetupRateLimiting(this WebApplicationBuilder builder)
    {
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Strict: 10 requests per minute per IP for auth / password-reset endpoints.
            options.AddFixedWindowLimiter(AuthPolicy, opt =>
            {
                opt.PermitLimit = 10;
                opt.Window = TimeSpan.FromMinutes(1);
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                opt.QueueLimit = 0;
            });

            // Relaxed: 300 requests per minute per IP for regular API calls.
            options.AddFixedWindowLimiter(GeneralPolicy, opt =>
            {
                opt.PermitLimit = 300;
                opt.Window = TimeSpan.FromMinutes(1);
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                opt.QueueLimit = 0;
            });
        });
    }
}
