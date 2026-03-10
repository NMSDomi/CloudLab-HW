using cloudhw_BE.BLL.Services.Interfaces;
using cloudhw_BE.DAL.Context;
using MailKit.Net.Smtp;
using MimeKit;

namespace cloudhw_BE.BLL.Services;

public class EmailService(ISystemContext systemContext, ILogger<EmailService> logger) : IEmailService
{
    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody)
    {
        // If SMTP is not configured, log the email to console (useful for local development)
        if (string.IsNullOrWhiteSpace(systemContext.SMTP_HOST))
        {
            logger.LogWarning(
                "SMTP not configured — email not sent.\n  To: {To}\n  Subject: {Subject}\n  Body:\n{Body}",
                toEmail, subject, htmlBody);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(systemContext.SMTP_FROM));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        var port = int.Parse(systemContext.SMTP_PORT);
        var useSsl = port == 465;

        await client.ConnectAsync(systemContext.SMTP_HOST, port, useSsl);

        // Only authenticate if credentials are provided
        if (!string.IsNullOrWhiteSpace(systemContext.SMTP_USER))
            await client.AuthenticateAsync(systemContext.SMTP_USER, systemContext.SMTP_PASSWORD);

        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    public async Task SendConfirmationEmailAsync(string toEmail, string userId, string token)
    {
        var encodedToken = Uri.EscapeDataString(token);
        var confirmUrl = $"{systemContext.FRONTEND_URL.TrimEnd('/')}/confirm-email?userId={Uri.EscapeDataString(userId)}&token={encodedToken}";

        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1a1a2e;">Email megerősítés — PikVjú</h2>
                <p>Kérjük, erősítsd meg az email címedet az alábbi gombra kattintva:</p>
                <a href="{confirmUrl}"
                   style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #e94560, #c23152);
                          color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                    Email megerősítése
                </a>
                <p style="margin-top: 24px; font-size: 0.85rem; color: #666;">
                    Ha nem te regisztráltál, kérjük hagyd figyelmen kívül ezt az üzenetet.
                </p>
            </div>
            """;

        await SendEmailAsync(toEmail, "Email megerősítés — PikVjú", html);
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string token)
    {
        var encodedToken = Uri.EscapeDataString(token);
        var resetUrl = $"{systemContext.FRONTEND_URL.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(toEmail)}&token={encodedToken}";

        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1a1a2e;">Jelszó visszaállítás — PikVjú</h2>
                <p>Kaptunk egy kérést a jelszavad visszaállítására. Kattints az alábbi gombra:</p>
                <a href="{resetUrl}"
                   style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #e94560, #c23152);
                          color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                    Jelszó visszaállítása
                </a>
                <p style="margin-top: 24px; font-size: 0.85rem; color: #666;">
                    Ha nem te kérted, kérjük hagyd figyelmen kívül ezt az üzenetet.
                </p>
            </div>
            """;

        await SendEmailAsync(toEmail, "Jelszó visszaállítás — PikVjú", html);
    }

    public async Task SendChangeEmailConfirmationAsync(string currentEmail, string newEmail, string userId, string token)
    {
        var encodedToken   = Uri.EscapeDataString(token);
        var encodedNew     = Uri.EscapeDataString(newEmail);
        var encodedUserId  = Uri.EscapeDataString(userId);
        var confirmUrl = $"{systemContext.FRONTEND_URL.TrimEnd('/')}/confirm-email-change?userId={encodedUserId}&newEmail={encodedNew}&token={encodedToken}";

        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1a1a2e;">Email cím módosítás — PikVjú</h2>
                <p>Kaptunk egy kérést a fiókod email címének megváltoztatására erre a címre: <strong>{newEmail}</strong></p>
                <p>A módosítás véglegesítéséhez kattints az alábbi gombra:</p>
                <a href="{confirmUrl}"
                   style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #e94560, #c23152);
                          color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                    Email cím módosítás megerősítése
                </a>
                <p style="margin-top: 24px; font-size: 0.85rem; color: #666;">
                    Ha nem te kérted ezt a módosítást, kérjük hagyd figyelmen kívül ezt az üzenetet. A jelenlegi email cím változatlan marad.
                </p>
            </div>
            """;

        await SendEmailAsync(newEmail, "Email cím módosítás megerősítése — PikVjú", html);
    }
}
