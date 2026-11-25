using System.Text;
using TwinCAT.Ads;
using TwinCAT.Ads.Server;

namespace CartonCell.Tests.AdsLoopback;

/// <summary>Minimal local ADS peer for the two-symbol wire contract. Requires a running ADS router.</summary>
internal sealed class SymbolTestServer() : AdsServer(Port, "Carton Cell contract test")
{
    public const ushort Port = 58051;

    private const uint HandleByName = 0xF003;
    private const uint ValueByHandle = 0xF005;
    private const uint ReleaseHandle = 0xF006;
    private const uint SymbolUploadInfo = 0xF00F;
    private const uint SumWrite = 0xF081;
    private const int StatusHandle = 1;
    private const int RequestHandle = 2;

    private int acknowledged;
    private int heartbeat;

    protected override Task<ResultReadWriteBytes> OnReadWriteAsync(
        AmsAddress peer, uint invokeId, uint group, uint offset, int length,
        ReadOnlyMemory<byte> data, CancellationToken cancellationToken)
    {
        // The ADS client batches symbol-handle releases when it disposes the connection.
        if (group == SumWrite && offset == 2 && length == 8)
        {
            return Task.FromResult(ResultReadWriteBytes.CreateSuccess(new byte[length]));
        }

        string name = Encoding.ASCII.GetString(data.Span).TrimEnd('\0');
        int handle = name switch
        {
            "GVL_HMI.Status" => StatusHandle,
            "GVL_HMI.Request" => RequestHandle,
            _ => 0
        };

        return Task.FromResult(group == HandleByName && handle != 0
            ? ResultReadWriteBytes.CreateSuccess(BitConverter.GetBytes(handle))
            : ResultReadWriteBytes.CreateError(AdsErrorCode.DeviceSymbolNotFound));
    }

    protected override Task<ResultReadBytes> OnReadAsync(
        AmsAddress peer, uint invokeId, uint group, uint offset, int length,
        CancellationToken cancellationToken)
    {
        if (group == SymbolUploadInfo && length == 64)
        {
            return Task.FromResult(ResultReadBytes.CreateSuccess(new byte[64]));
        }

        if (group != ValueByHandle || offset != StatusHandle || length != 80)
        {
            return Task.FromResult(ResultReadBytes.CreateError(AdsErrorCode.DeviceInvalidOffset));
        }

        var words = new int[20];
        words[0] = Frame.Signature;
        words[1] = (int)(acknowledged == 0 ? CellState.Stopped : CellState.Resetting);
        words[8] = acknowledged;
        words[9] = ++heartbeat;
        words[10] = 1;
        words[12] = 1120;
        words[14] = -120;

        var wire = new byte[80];
        Buffer.BlockCopy(words, 0, wire, 0, wire.Length);
        return Task.FromResult(ResultReadBytes.CreateSuccess(wire));
    }

    protected override Task<ResultWrite> OnWriteAsync(
        AmsAddress peer, uint invokeId, uint group, uint offset,
        ReadOnlyMemory<byte> data, CancellationToken cancellationToken)
    {
        if (group == ReleaseHandle)
        {
            return Task.FromResult(ResultWrite.CreateSuccess());
        }

        if (group != ValueByHandle || offset != RequestHandle || data.Length != sizeof(int))
        {
            return Task.FromResult(ResultWrite.CreateError(AdsErrorCode.DeviceInvalidOffset));
        }

        acknowledged = BitConverter.ToInt32(data.Span);
        return Task.FromResult(ResultWrite.CreateSuccess());
    }
}
