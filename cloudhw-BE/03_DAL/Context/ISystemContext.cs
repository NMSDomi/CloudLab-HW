namespace cloudhw_BE.DAL.Context;

public interface ISystemContext
{
    //POSTGRES
    public string POSTGRES_HOST { get; set; }
    public string POSTGRES_PORT { get; set; }
    public string POSTGRES_USER { get; set; }
    public string POSTGRES_PASSWORD { get; set; }
    public string POSTGRES_DB { get; set; }

    //JWT
    public string JWT_ISSUER { get; set; }
    public string JWT_AUDIANCE { get; set; }
    public string JWT_KEY { get; set; }

    //ADMIN USER
    public string ADMIN_EMAIL { get; set; }
    public string ADMIN_PASSWORD { get; set; }
    public string ADMIN_NAME { get; set; }

    //SMTP (Email)
    public string SMTP_HOST { get; set; }
    public string SMTP_PORT { get; set; }
    public string SMTP_USER { get; set; }
    public string SMTP_PASSWORD { get; set; }
    public string SMTP_FROM { get; set; }

    //FRONTEND
    public string FRONTEND_URL { get; set; }

    string GetConnectionString();
}
