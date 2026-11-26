using CartonCell;
using System.Diagnostics;

var clock = new ScanClock();
using var machine = new SimulatedMachine(clock);
int seq = 100;
Frame Scan(int count)
{
    clock.Advance(count);
    return machine.Read();
}
void Check(bool pass, string name)
{
    if (!pass) throw new InvalidOperationException(name);
}
void Send(OperatorCommand command, bool ok = true, int? token = null)
{
    int word = ((token ?? ++seq) << 8) | (int)command;
    machine.Write(word);
    var f = machine.Read();
    Check(f.Ack == word && f.Accepted == ok, command.ToString());
}
void Start()
{
    Send(OperatorCommand.Reset);
    Scan(45);
    Send(OperatorCommand.Start);
    Scan(45);
}
Start();
var watch = Stopwatch.StartNew();
var ids = new HashSet<int>();
bool sawFlying = false;
int lastDischargeScan = -1;
for (int scan = 0; scan < 60000; scan++)
{
    var line = Scan(1).Line!;
    int[] live = line.Products.Where(x => x != 0).ToArray();
    Check(live.Distinct().Count() == live.Length, "Duplicate ownership");
    Check(line.Issued == line.Good + line.Rejected + line.Discarded + live.Length, "Conservation");
    if (line.LastId > 0 && ids.Add(line.LastId))
    {
        if (lastDischargeScan >= 0) Check(scan - lastDischargeScan == 200, "Two-second discharge pitch");
        lastDischargeScan = scan;
    }
    if (line.CamZ[5] == 40 && line.Travel > 0 && line.CamX[5] == line.Travel/2) sawFlying = true;
}
watch.Stop();
var steady = machine.Read().Line!;
Check(sawFlying && steady.Good == 289 && ids.Count == 289 && steady.LastChecked == 1023, "10 minute output / flying cam");
Console.WriteLine($"PASS  60,000 observed scans in {watch.Elapsed.TotalMilliseconds:F0} ms; {steady.Good} packed, 11 in flight; steady 30/min");
Send(OperatorCommand.Hold);
var held = Scan(1000).Line!;
Check(held.Products.SequenceEqual(steady.Products) && held.Tick == steady.Tick && held.PlannedTicks > steady.PlannedTicks && held.RunTicks == steady.RunTicks, "Hold / OEE");
Send(OperatorCommand.Unhold);
Scan(45);
Send(OperatorCommand.MissingSeal);
Check(Scan(650).Line!.Rejected >= 2, "Final vision rejects");
Send(OperatorCommand.RestoreSeal);
Send(OperatorCommand.JamClamp);
var fault = Scan(300);
Check(fault.State == CellState.Aborted && fault.Line!.ClampRequest && fault.Line.ClampMm < 16, "Jam diagnostics");
int occurrence = fault.Line!.Occurrence;
Send(OperatorCommand.AckClamp, false, occurrence+1);
Send(OperatorCommand.Clear,false);
Send(OperatorCommand.AckClamp,true,occurrence);
Send(OperatorCommand.Clear,false);
Send(OperatorCommand.ReleaseClamp);
Send(OperatorCommand.Clear);
Scan(45);
Send(OperatorCommand.Precision);
Start();
var slow = Scan(4000).Line!;
Check(slow.Discarded > 0 && slow.Precision && slow.Good >= steady.Good+9 && slow.LastId > steady.LastId, "Reset and recipe");
Console.WriteLine("PASS  hold timing, seal reject, stale acknowledgment, recovery, reset discards and 30/min recipe");

sealed class ScanClock : TimeProvider
{
    private long time;
    public override long TimestampFrequency => 100;
    public override long GetTimestamp() => time;
    public void Advance(int scans) => time += scans;
}
