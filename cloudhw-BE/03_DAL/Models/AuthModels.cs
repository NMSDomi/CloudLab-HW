namespace cloudhw_BE.DAL.Models;

public record RefreshRequest(string Token, string RefreshToken);

public record RegisterRequest(string Email, string Password, string Name, string? Role);

public record UpdateProfileRequest(string Name, string Email);

public record UpdateRoleRequest(string Role);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
