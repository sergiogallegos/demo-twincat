namespace CartonCell;

public enum CellState
{
    Undefined, Clearing, Stopped, Starting, Idle, Suspended, Execute, Stopping, Aborting,
    Aborted, Holding, Held, Unholding, Suspending, Unsuspending, Resetting, Completing, Complete
}

public enum OperatorCommand
{
    Reset = 1, Start, Hold, Unhold, Suspend, Unsuspend, Stop, Abort, Clear,
    Automatic, Manual, Stroke1, Stroke2, Stroke3, Stroke4, Stroke5,
    DropAir, RestoreAir, LowBlanks, Refill, MissingSeal, RestoreSeal,
    LoopLine, Bench, Standard, Precision, JamClamp, ReleaseClamp, AckClamp
}

public record Frame(CellState State, bool Manual, int Station, int Phase, int Cartons,
    bool AirFault, bool LowStock, int Ack, int Heartbeat, bool Accepted, DeviceFrame Devices, LineFrame? Line = null)
{
    public const int Signature = 51003;
    public const int WordCount = 106;
    public static Frame Initial => new(CellState.Stopped, false, 0, 0, 0, false, false, 0, 0, true, new());

    public bool Allows(OperatorCommand command) => command switch
    {
        OperatorCommand.DropAir => !AirFault,
        OperatorCommand.RestoreAir => AirFault,
        OperatorCommand.LowBlanks => !LowStock,
        OperatorCommand.Refill => LowStock,
        OperatorCommand.MissingSeal => !Devices.MissingSeal,
        OperatorCommand.RestoreSeal => Devices.MissingSeal,
        OperatorCommand.LoopLine => State == CellState.Stopped && !Manual && Line?.Enabled == false,
        OperatorCommand.Bench => State == CellState.Stopped && !Manual && Line?.Enabled == true,
        OperatorCommand.Standard => State == CellState.Stopped && !Manual && Line is { Enabled: true, Precision: true },
        OperatorCommand.Precision => State == CellState.Stopped && !Manual && Line is { Enabled: true, Precision: false },
        OperatorCommand.JamClamp => !Manual && Line is { Enabled: true, Jammed: false, Alarm: 0 },
        OperatorCommand.ReleaseClamp => Line?.Jammed == true,
        OperatorCommand.AckClamp => State == CellState.Aborted && Line?.Alarm == 1,
        OperatorCommand.Clear => State == CellState.Aborted && !AirFault && (Line?.Alarm is null or 0 || Line is { Alarm: 2, Jammed: false }),
        OperatorCommand.Abort => State is not (CellState.Aborting or CellState.Aborted or CellState.Undefined),
        OperatorCommand.Stop => State is not (CellState.Undefined or CellState.Stopped or CellState.Stopping
            or CellState.Aborted or CellState.Aborting or CellState.Clearing),
        OperatorCommand.Reset => !AirFault && State is CellState.Stopped or CellState.Complete,
        OperatorCommand.Start => !Manual && State == CellState.Idle,
        OperatorCommand.Hold or OperatorCommand.Suspend => State == CellState.Execute && !Manual,
        OperatorCommand.Unhold => State == CellState.Held,
        OperatorCommand.Unsuspend => State == CellState.Suspended,
        OperatorCommand.Automatic => Manual && State == CellState.Stopped,
        OperatorCommand.Manual => !Manual && State == CellState.Stopped,
        >= OperatorCommand.Stroke1 and <= OperatorCommand.Stroke5 => Manual && State == CellState.Idle,
        _ => false
    };
}

public interface IMachine : IDisposable
{
    string Source { get; }
    Frame Read();
    void Write(int request);
}
