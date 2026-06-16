using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using NLog.Web;
using alertblurty.Api.Configuration;
using alertblurty.Api.Endpoints;
using alertblurty.Api.Middleware;
using alertblurty.Data;
using alertblurty.Data.Repositories;
using alertblurty.Data.Services;
using alertblurty.Models.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Configure NLog
builder.Logging.ClearProviders();
builder.Host.UseNLog();

var localConfigPath = builder.Configuration["ALERTYBLURTY_CONFIG_PATH"]
    ?? Path.Combine(builder.Environment.ContentRootPath, "data", "appsettings.Local.json");

builder.Configuration.AddJsonFile(localConfigPath, optional: true, reloadOnChange: true);
builder.Configuration.AddEnvironmentVariables();

var runtimeConfiguration = new BootstrapConfigurationStore(builder.Configuration, builder.Environment);
builder.Services.AddSingleton(runtimeConfiguration);
builder.Services.AddSingleton<IAlertBlurtyRuntimeConfiguration>(runtimeConfiguration);

// Configure Database
builder.Services.AddDbContext<AlertBlurtyDbContext>((serviceProvider, options) =>
{
    var configuration = serviceProvider.GetRequiredService<IAlertBlurtyRuntimeConfiguration>();
    options.UseNpgsql(configuration.GetRequiredConnectionString());
});

// Register Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IOrganizationRepository, OrganizationRepository>();
builder.Services.AddScoped<ITeamRepository, TeamRepository>();
builder.Services.AddScoped<IIncidentRepository, IncidentRepository>();
builder.Services.AddScoped<IScheduleRepository, ScheduleRepository>();

// Register Services
builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IIncidentService, IncidentService>();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = runtimeConfiguration.JwtIssuer,
        ValidAudience = runtimeConfiguration.JwtAudience,
        IssuerSigningKeyResolver = (_, _, _, _) =>
        {
            var jwtSecret = runtimeConfiguration.GetRequiredJwtSecret();
            return [new SymmetricSecurityKey(Encoding.ASCII.GetBytes(jwtSecret))];
        }
    };
});

builder.Services.AddAuthorization();

var dataProtectionPath = Path.Combine(builder.Environment.ContentRootPath, "data", "DataProtection-Keys");
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionPath));

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "AlertyBlurty API",
        Version = "v1",
        Description = "On-call alert router for Zabbix 7.4 with SMS notifications",
        Contact = new OpenApiContact
        {
            Name = "AlertyBlurty Support",
            Email = "support@alertyblurty.com"
        }
    });

    // Add JWT authentication to Swagger
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer", document, "Bearer"),
            []
        }
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = DisableIndexCaching
});

// Global exception handling
app.UseMiddleware<GlobalExceptionHandler>();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
    .WithName("HealthCheck");

// Map all endpoints
app.MapSetupEndpoints();
app.MapAuthEndpoints();
app.MapOrganizationEndpoints();
app.MapUserEndpoints();
app.MapTeamEndpoints();
app.MapScheduleEndpoints();
app.MapIncidentEndpoints();
app.MapWebhookEndpoints();
app.MapFallbackToFile("index.html", new StaticFileOptions
{
    OnPrepareResponse = DisableIndexCaching
});

LogStartupInstructions(app);

app.Run();

static void LogStartupInstructions(WebApplication app)
{
    var configuredHostPort = app.Configuration["ALERTYBLURTY_PORT"];
    var hostPort = int.TryParse(configuredHostPort, out var parsedPort) && parsedPort is > 0 and <= 65535
        ? parsedPort
        : 18080;

    app.Logger.LogInformation(
        "AlertyBlurty is running. If using Docker Compose defaults, open http://localhost:{HostPort} and complete first-run setup. If ALERTYBLURTY_PORT or a reverse proxy is configured, use that public URL instead.",
        hostPort);
}

static void DisableIndexCaching(StaticFileResponseContext context)
{
    if (!string.Equals(context.File.Name, "index.html", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    context.Context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
    context.Context.Response.Headers.Pragma = "no-cache";
    context.Context.Response.Headers.Expires = "0";
}

public partial class Program;
