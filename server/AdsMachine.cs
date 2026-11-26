using TwinCAT.Ads;

namespace CartonCell;

public sealed class AdsMachine(IConfiguration configuration) : IMachine
{
    private AdsClient? client;
    private uint statusHandle;
    private uint requestHandle;

    public Frame Read()
    {
        if (client is null)
        {
            client = new AdsClient { Timeout = 700 };
            client.Connect(configuration["Machine:AmsNetId"]!,
                configuration.GetValue<int>("Machine:Port"));
            statusHandle = client.CreateVariableHandle("GVL_HMI.Status");
            requestHandle = client.CreateVariableHandle("GVL_HMI.Request");
        }
        var words = (int[])client.ReadAny(statusHandle, typeof(int[]), [Frame.WordCount]);
        if (words[0] != Frame.Signature || !Enum.IsDefined((CellState)words[1])
            || words[3] is < 0 or > 5 || words[4] is < 0 or > 200)
        {
            throw new InvalidDataException("PLC status does not match Carton Cell protocol 51003.");
        }
        return new((CellState)words[1], words[2] == 1, words[3], words[4], words[5],
            words[6] != 0, words[7] != 0, words[8], words[9], words[10] == 1,
            new DeviceFrame(words[11], words[12], words[13], words[14], (SealResult)words[15],
                words[16], words[17] != 0, words[18] != 0, words[19]), LineFrame.Decode(words));
    }

    public void Write(int request) => client!.WriteAny(requestHandle, request);

    public void Dispose()
    {
        client?.Dispose();
        client = null;
    }
}
