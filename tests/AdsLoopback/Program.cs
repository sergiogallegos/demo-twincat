using CartonCell;
using Microsoft.Extensions.Configuration;

namespace CartonCell.Tests.AdsLoopback;

internal static class Program
{
    private static void Main()
    {
        using var target = new SymbolTestServer();
        target.ConnectServer();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Machine:AmsNetId"] = "127.0.0.1.1.1",
                ["Machine:Port"] = SymbolTestServer.Port.ToString()
            })
            .Build();

        using var adapter = new AdsMachine(configuration);
        Frame first = adapter.Read();
        Check(first.State == CellState.Stopped && first.Devices.TrackMm == 1120,
            "Initial status decoding failed.");

        const int resetRequest = (1 << 8) | (int)OperatorCommand.Reset;
        adapter.Write(resetRequest);
        Frame next = adapter.Read();
        Check(next.Ack == resetRequest && next.Accepted && next.State == CellState.Resetting,
            "Command did not round-trip through the router.");
        Check(next.Devices.PlanarYmm == -120, "Signed device position was decoded incorrectly.");

        // Closing and reopening forces another pair of symbol-handle acquisitions.
        adapter.Dispose();
        Check(adapter.Read().Ack == resetRequest, "Reconnect lost the target state.");
        Console.WriteLine("PASS  ADS symbols, status block, command acknowledgment and reconnect");
    }

    private static void Check(bool valid, string message)
    {
        if (!valid)
        {
            throw new InvalidOperationException(message);
        }
    }
}
