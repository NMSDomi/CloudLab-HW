namespace cloudhw_BE.DAL.Models;

public record LoginRequest(string Email, string Password, bool RememberMe = false);

public record RefreshRequest(string Token, string RefreshToken);

public record RegisterRequest(string Email, string Password, string Name);

public record UpdateProfileRequest(string Name, string Email);

public record UpdateRoleRequest(string Role);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record ForgotPasswordRequest(string Email);

public record ResetPasswordWithTokenRequest(string Email, string Token, string NewPassword);

public record ResendConfirmationRequest(string Email);

public record ConfirmEmailChangeRequest(string UserId, string NewEmail, string Token);
