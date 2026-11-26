namespace CartonCell;

public sealed record LineFrame(bool Enabled, bool Precision, int Tick, int Index, int Issued,
    int Good, int Rejected, int LastId, int LastFailed, bool Jammed, int Occurrence, int Alarm,
    bool ClampRequest, int ClampMm, int RunTicks, int PlannedTicks, int IdealTicks, int Discarded,
    int[] Products, int[] Checked, int[] Failed, int[] CamX, int[] CamZ, int Travel, int LastChecked)
{
    public static LineFrame Decode(int[] w) => new(w[20] == 1, w[21] == 1, w[22], w[23],
        w[24], w[25], w[26], w[27], w[28], w[29] == 1, w[30], w[31], w[32] == 1, w[33],
        w[34], w[35], w[36], w[37], w[40..56], w[56..72], w[72..88], w[88..96], w[96..104], w[104], w[105]);
}

internal interface IClamp
{
    int PositionMm { get; }
    void Scan(bool extend, bool jammed);
    void Home();
}

internal sealed class VirtualClamp : IClamp
{
    public int PositionMm { get; private set; }
    public void Scan(bool extend, bool jammed)
    {
        if (!extend) PositionMm = Math.Max(0, PositionMm - 4);
        else if (!jammed) PositionMm = Math.Min(16, PositionMm + 4);
    }
    public void Home() => PositionMm = 0;
}

internal sealed class ContinuousLine
{
    private readonly int[] products = new int[16], checkedMask = new int[16], failed = new int[16];
    private readonly int[] camX = new int[8], camZ = new int[8];
    private readonly IClamp clamp = new VirtualClamp();
    public bool Enabled { get; set; } = true;
    public bool Precision { get; set; }
    public bool Jammed { get; set; }
    public int Alarm { get; private set; }
    public int Occurrence { get; private set; }
    public bool Timing { get; set; }
    private int tick, index, issued, good, rejected, lastId, lastFailed, lastChecked, discarded;
    private int runTicks, plannedTicks, idealTicks, clampWait, travel;
    private bool clampRequest;
    private const int Period = 200; // 2 s at the 10 ms scan rate

    public LineFrame Snapshot() => new(Enabled, Precision, tick, index, issued, good, rejected,
        lastId, lastFailed, Jammed, Occurrence, Alarm, clampRequest, clamp.PositionMm, runTicks,
        plannedTicks, idealTicks, discarded, (int[])products.Clone(), (int[])checkedMask.Clone(),
        (int[])failed.Clone(), (int[])camX.Clone(), (int[])camZ.Clone(), travel, lastChecked);

    public void Clock(bool executing)
    {
        if (!Timing) return;
        plannedTicks++;
        if (executing) runTicks++;
    }

    public bool Acknowledge(int occurrence)
    {
        if (Alarm != 1 || occurrence != Occurrence) return false;
        Alarm = 2;
        return true;
    }

    public void Recover() => Alarm = 0;

    public void Reset()
    {
        discarded += products.Count(id => id != 0);
        Array.Clear(products);
        Array.Clear(checkedMask);
        Array.Clear(failed);
        Array.Clear(camX);
        Array.Clear(camZ);
        tick = index = travel = clampWait = 0;
        clampRequest = false;
        clamp.Home();
    }

    // Cubic electronic cam, zero endpoint velocity. Input 0..100, output 0..1000.
    private static int Ease(int u)
    {
        u = Math.Clamp(u, 0, 100);
        return u * u * (300 - 2 * u) / 1000;
    }

    private int AtSlot(int slot, int count) => (slot + count - index % count) % count;
    private void Inspect(int mover, int bit, bool pass)
    {
        checkedMask[mover] |= 1 << bit;
        if (!pass) failed[mover] |= 1 << bit;
    }

    public void Step(bool missingSeal)
    {
        int p = tick * 100 / Period;
        bool first = tick % (Period / 100) == 0;
        int pickup = AtSlot(0, 10);
        if (tick == 0 && products[pickup] == 0) products[pickup] = ++issued;
        clampRequest = products[AtSlot(2, 10)] != 0 && p >= 12 && p < 54;
        clamp.Scan(clampRequest, Jammed);
        clampWait = clampRequest && clamp.PositionMm < 16 ? clampWait + 1 : 0;
        if (clampWait >= 15)
        {
            Occurrence = Occurrence % 0x7ffffe + 1;
            Alarm = 1;
            return;
        }

        int reach = p < 12 ? Ease(p * 100 / 12) : p < 48 ? 1000 : 1000 - Ease((p - 48) * 100 / 12);
        int depth = p < 12 ? 0 : p < 26 ? Ease((p - 12) * 100 / 14) :
            p < 36 ? 1000 : 1000 - Ease((p - 36) * 100 / 12);
        travel = Ease((p - 60) * 100 / 40);
        for (int station = 0; station < 8; station++)
        {
            int mover = AtSlot(station < 4 ? station : station + 1, 10);
            bool loaded = products[mover] != 0;
            camX[station] = loaded ? reach * (100 + station * 4) / 1000 : 0;
            camZ[station] = loaded ? depth * (Precision ? 48 : 40) / 1000 : 0;
            // ST-06 follows the moving nest 1:1 over the first half of a 500 mm index.
            if (station == 5 && loaded)
            {
                camX[station] = p <= 80 ? travel / 2 : 250 - Ease((p - 80) * 100 / 20) / 4;
                camZ[station] = p < 60 ? 0 : (p <= 74 ? Ease((p-60)*100/14) : 1000-Ease((p-78)*100/8)) * (Precision ? 48 : 40) / 1000;
            }
            if (loaded && p == (station == 5 ? 76 : 32) && first)
                Inspect(mover, station, camZ[station] == (Precision ? 48 : 40) && (station != 2 || clamp.PositionMm == 16));
        }

        if (p == 54 && first) ProcessTable(missingSeal);
        if (++tick == Period)
        {
            tick = travel = 0;
            index = (index + 1) % 30;
        }
    }

    private void ProcessTable(bool missingSeal)
    {
        int source = AtSlot(8, 10), target = 10 + AtSlot(0, 6);
        if (products[source] != 0 && products[target] == 0)
        {
            products[target] = products[source];
            checkedMask[target] = checkedMask[source];
            failed[target] = failed[source];
            products[source] = checkedMask[source] = failed[source] = 0;
        }
        int seat = 10 + AtSlot(1, 6), camera = 10 + AtSlot(2, 6), pack = 10 + AtSlot(3, 6);
        if (products[seat] != 0) Inspect(seat, 8, (checkedMask[seat] & 255) == 255);
        if (products[camera] != 0) Inspect(camera, 9, CellDevices.BrightSamples(missingSeal) >= 4);
        if (products[pack] == 0) return;
        lastId = products[pack];
        lastChecked = checkedMask[pack];
        lastFailed = failed[pack];
        if (lastChecked == 1023 && lastFailed == 0) good++; else rejected++;
        idealTicks += Period;
        // Consuming the payload provides a separate finished latch for each mover.
        products[pack] = checkedMask[pack] = failed[pack] = 0;
    }
}
