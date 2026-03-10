namespace cloudhw_BE.DAL.Context;
public class SystemContext : ISystemContext
{
    //POSTGRES
    public string POSTGRES_HOST { get; set; } = "";
    public string POSTGRES_PORT { get; set; } = "";
    public string POSTGRES_USER { get; set; } = "";
    public string POSTGRES_PASSWORD { get; set; } = "";
    public string POSTGRES_DB { get; set; } = "";

    //JWT
    public string JWT_ISSUER { get; set; } = "";
    public string JWT_AUDIANCE { get; set; } = "";
    public string JWT_KEY { get; set; } = "";

    //ADMIN USER
    public string ADMIN_EMAIL { get; set; } = "";
    public string ADMIN_PASSWORD { get; set; } = "";
    public string ADMIN_NAME { get; set; } = "";

    //SMTP (Email)
    public string SMTP_HOST { get; set; } = "";
    public string SMTP_PORT { get; set; } = "";
    public string SMTP_USER { get; set; } = "";
    public string SMTP_PASSWORD { get; set; } = "";
    public string SMTP_FROM { get; set; } = "";

    //FRONTEND
    public string FRONTEND_URL { get; set; } = "";

    //QDRANT
    public string QDRANT_URL { get; set; } = "";

    //API KEYS
    public string OPENAI_APIKEY { get; set; } = "";

    public SystemContext()
    {
        SetContextDefaults();
        SetContextFromEnv();
        ValidateRequired();
    }

    public void SetContextDefaults()
    {
        //POSTGRES – real values come from environment variables / .env
        POSTGRES_HOST = "";
        POSTGRES_PORT = "5432";
        POSTGRES_USER = "";
        POSTGRES_PASSWORD = "";
        POSTGRES_DB = "";

        //JWT – MUST be set via environment variables
        JWT_ISSUER = "";
        JWT_AUDIANCE = "";
        JWT_KEY = "";

        //ADMIN USER – MUST be set via environment variables
        ADMIN_EMAIL = "";
        ADMIN_PASSWORD = "";
        ADMIN_NAME = "";

        //SMTP – optional for local dev (falls back to console logging)
        SMTP_HOST = "";
        SMTP_PORT = "587";
        SMTP_USER = "";
        SMTP_PASSWORD = "";
        SMTP_FROM = "";

        //FRONTEND
        FRONTEND_URL = "http://localhost:4200";
    }

    /// <summary>Throws if any required secret is still empty after env-var loading.</summary>
    public void ValidateRequired()
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(POSTGRES_HOST)) missing.Add(nameof(POSTGRES_HOST));
        if (string.IsNullOrWhiteSpace(POSTGRES_USER)) missing.Add(nameof(POSTGRES_USER));
        if (string.IsNullOrWhiteSpace(POSTGRES_PASSWORD)) missing.Add(nameof(POSTGRES_PASSWORD));
        if (string.IsNullOrWhiteSpace(POSTGRES_DB)) missing.Add(nameof(POSTGRES_DB));
        if (string.IsNullOrWhiteSpace(JWT_KEY)) missing.Add(nameof(JWT_KEY));
        if (string.IsNullOrWhiteSpace(ADMIN_EMAIL)) missing.Add(nameof(ADMIN_EMAIL));
        if (string.IsNullOrWhiteSpace(ADMIN_PASSWORD)) missing.Add(nameof(ADMIN_PASSWORD));

        if (missing.Count > 0)
            throw new InvalidOperationException(
                $"Missing required environment variables: {string.Join(", ", missing)}. " +
                "Set them via OS environment variables or a .env file.");
    }

    public void SetContextFromEnv()
    {
        //POSTGRES
        SetForEnvIfNotNullOrEmpty(nameof(POSTGRES_HOST));
        SetForEnvIfNotNullOrEmpty(nameof(POSTGRES_PORT));
        SetForEnvIfNotNullOrEmpty(nameof(POSTGRES_USER));
        SetForEnvIfNotNullOrEmpty(nameof(POSTGRES_PASSWORD));
        SetForEnvIfNotNullOrEmpty(nameof(POSTGRES_DB));

        //JWT
        SetForEnvIfNotNullOrEmpty(nameof(JWT_ISSUER));
        SetForEnvIfNotNullOrEmpty(nameof(JWT_AUDIANCE));
        SetForEnvIfNotNullOrEmpty(nameof(JWT_KEY));

        //ADMIN USER
        SetForEnvIfNotNullOrEmpty(nameof(ADMIN_EMAIL));
        SetForEnvIfNotNullOrEmpty(nameof(ADMIN_PASSWORD));
        SetForEnvIfNotNullOrEmpty(nameof(ADMIN_NAME));

        //SMTP
        SetForEnvIfNotNullOrEmpty(nameof(SMTP_HOST));
        SetForEnvIfNotNullOrEmpty(nameof(SMTP_PORT));
        SetForEnvIfNotNullOrEmpty(nameof(SMTP_USER));
        SetForEnvIfNotNullOrEmpty(nameof(SMTP_PASSWORD));
        SetForEnvIfNotNullOrEmpty(nameof(SMTP_FROM));

        //FRONTEND
        SetForEnvIfNotNullOrEmpty(nameof(FRONTEND_URL));
    }

    public void SetValueByName(string name, string value)
    {
        if (!string.IsNullOrEmpty(value))
        {
            switch (name)
            {
                case nameof(POSTGRES_HOST): POSTGRES_HOST = value; break;
                case nameof(POSTGRES_PORT): POSTGRES_PORT = value; break;
                case nameof(POSTGRES_USER): POSTGRES_USER = value; break;
                case nameof(POSTGRES_PASSWORD): POSTGRES_PASSWORD = value; break;
                case nameof(POSTGRES_DB): POSTGRES_DB = value; break;

                case nameof(QDRANT_URL): QDRANT_URL = value; break;

                case nameof(JWT_ISSUER): JWT_ISSUER = value; break;
                case nameof(JWT_AUDIANCE): JWT_AUDIANCE = value; break;
                case nameof(JWT_KEY): JWT_KEY = value; break;

                case nameof(ADMIN_EMAIL): ADMIN_EMAIL = value; break;
                case nameof(ADMIN_PASSWORD): ADMIN_PASSWORD = value; break;
                case nameof(ADMIN_NAME): ADMIN_NAME = value; break;

                case nameof(SMTP_HOST): SMTP_HOST = value; break;
                case nameof(SMTP_PORT): SMTP_PORT = value; break;
                case nameof(SMTP_USER): SMTP_USER = value; break;
                case nameof(SMTP_PASSWORD): SMTP_PASSWORD = value; break;
                case nameof(SMTP_FROM): SMTP_FROM = value; break;

                case nameof(FRONTEND_URL): FRONTEND_URL = value; break;

                case nameof(OPENAI_APIKEY): OPENAI_APIKEY = value; break;
            }
        }
    }

    public void SetForEnvIfNotNullOrEmpty(string envVarName)
    {
        var value = Environment.GetEnvironmentVariable(envVarName);
        if (!string.IsNullOrEmpty(value))
            SetValueByName(envVarName, value);
    }

    public string GetConnectionString()
    {
        var connStr = "Host=" + POSTGRES_HOST + ":" + POSTGRES_PORT + ";Username=" + POSTGRES_USER + ";Password=" + POSTGRES_PASSWORD + ";Database=" + POSTGRES_DB;

        // Only include detailed error info in development
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        if (string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
            connStr += ";Include Error Detail=true";

        return connStr;
    }
}
