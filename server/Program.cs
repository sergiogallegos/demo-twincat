using System.Text.Json.Serialization;
using CartonCell;

var builder = WebApplication.CreateBuilder(args);
// Keep the local console independent of operating-system event log permissions.
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton<IMachine>(services =>
    builder.Configuration["Machine:Source"]?.ToLowerInvariant() switch
    {
        "ads" => new AdsMachine(builder.Configuration),
        "simulation" => new SimulatedMachine(),
        _ => throw new InvalidOperationException("Machine:Source must be Ads or Simulation.")
    });
builder.Services.AddSingleton<ConsoleService>();
builder.Services.AddHostedService(services => services.GetRequiredService<ConsoleService>());
var app = builder.Build();
app.UseDefaultFiles();
// The 3D scene is a local binary glTF asset served alongside the React bundle.
var contentTypes = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
contentTypes.Mappings[".glb"] = "model/gltf-binary";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });
app.MapGet("/api/model", (IWebHostEnvironment env) =>
    new { available = File.Exists(Path.Combine(env.ContentRootPath, "wwwroot", "vendor", "components.glb")) });
app.MapGet("/api/machine", (ConsoleService console) => console.Snapshot());
app.MapPost("/api/commands", (CommandRequest request, ConsoleService console) =>
    Enum.TryParse<OperatorCommand>(request.Command, false, out var command) && Enum.IsDefined(command)
        ? console.Command(command) : Results.BadRequest("Unknown command."));
app.MapPost("/api/messages", (OperatorNote note, ConsoleService console) => console.AddMessage(note.Text));
app.Run();

internal record CommandRequest(string Command);

internal record OperatorNote(string? Text);
