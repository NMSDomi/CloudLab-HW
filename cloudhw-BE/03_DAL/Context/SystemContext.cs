namespace cloudhw_BE.DAL.Context;
public class SystemContext : ISystemContext
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

    //QDRANT
    public string QDRANT_URL { get; set; }

    //API KEYS
    public string OPENAI_APIKEY { get; set; }

    public SystemContext()
    {
        SetContextDefaults();
        SetContextFromEnv();
    }

    public void SetContextDefaults()
    {
        //POSTGRES
        POSTGRES_HOST = "localhost";
        POSTGRES_PORT = "5435";
        POSTGRES_USER = "postgres";
        POSTGRES_PASSWORD = "example";
        POSTGRES_DB = "cloudhw-db";

        //JWT
        JWT_ISSUER = "CloudHW";
        JWT_AUDIANCE = "CloudHW User";
        JWT_KEY = "SHFzdnmcgd648°^šdcaa##y<UIHDpfgkmvzdf792kaskdjmvkahflélogpőádehatz";

        //ADMIN USER
        ADMIN_EMAIL = "cloudhw@cloudhw.com";
        ADMIN_PASSWORD = "Admin123";
        ADMIN_NAME = "cloudhw";

        //QDRANT
        QDRANT_URL = "http://localhost:8000";

        //API KEYS
        OPENAI_APIKEY = "";
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

        //QDRANT
        SetForEnvIfNotNullOrEmpty(nameof(QDRANT_URL));

        //API KEYS
        SetForEnvIfNotNullOrEmpty(nameof(OPENAI_APIKEY));
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
        return "Host=" + POSTGRES_HOST + ";Port=" + POSTGRES_PORT + ";Username=" + POSTGRES_USER + ";Password=" + POSTGRES_PASSWORD + ";Database=" + POSTGRES_DB + ";Include Error Detail=true";
    }
}
