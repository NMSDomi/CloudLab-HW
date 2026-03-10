namespace cloudhw_BE.BLL.Services.Interfaces;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string htmlBody);
    Task SendConfirmationEmailAsync(string toEmail, string userId, string token);
    Task SendPasswordResetEmailAsync(string toEmail, string token);
    Task SendChangeEmailConfirmationAsync(string currentEmail, string newEmail, string userId, string token);
}
