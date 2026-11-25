namespace CartonCell;

public enum SealResult
{
    Pending,
    Pass,
    Reject
}

/// <summary>Feedback from the virtual feed, single track mover, inspection and sorting table.</summary>
public record DeviceFrame(int FeedMm = 0, int TrackMm = 0, int PlanarXmm = 0, int PlanarYmm = 0,
    SealResult Inspection = SealResult.Pending, int Rejected = 0, bool MissingSeal = false,
    bool Indexing = false, int BrightSamples = 0);

public sealed class CellDevices
{
    public DeviceFrame Feedback { get; private set; } = new();

    public void Reset()
    {
        Feedback = new DeviceFrame(Rejected: Feedback.Rejected, MissingSeal: Feedback.MissingSeal);
    }

    public void SetMissingSeal(bool missing)
    {
        Feedback = Feedback with { MissingSeal = missing };
    }

    // The two 8-bit scan lines correspond to the BMP fixtures in web/public/vision.
    private void Inspect()
    {
        int[] pixels = Feedback.MissingSeal ? [118, 122, 120, 124, 121] : [231, 236, 228, 239, 232];
        int bright = pixels.Count(value => value >= 200);
        Feedback = Feedback with
        {
            BrightSamples = bright,
            Inspection = bright >= 4 ? SealResult.Pass : SealResult.Reject
        };
    }

    private static int Approach(int position, int target, int increment)
    {
        return position + Math.Clamp(target - position, -increment, increment);
    }

    public void Process(int station, int phase)
    {
        if (station == 1)
        {
            Feedback = Feedback with { FeedMm = Approach(Feedback.FeedMm, 180, 2) };
        }

        if (station == 4 && phase >= 100 && Feedback.Inspection == SealResult.Pending)
        {
            Inspect();
        }

        if (station == 5)
        {
            int lane = Feedback.Inspection == SealResult.Pass ? 120 : -120;
            Feedback = Feedback with
            {
                PlanarXmm = Approach(Feedback.PlanarXmm, 240, 2),
                PlanarYmm = Approach(Feedback.PlanarYmm, lane, 2)
            };
        }
    }

    public bool ReadyToLeave(int station) => station switch
    {
        1 => Feedback.FeedMm == 180,
        4 => Feedback.Inspection != SealResult.Pending,
        5 => Feedback.PlanarXmm == 240 && Feedback.PlanarYmm ==
            (Feedback.Inspection == SealResult.Pass ? 120 : -120),
        _ => true
    };

    public bool IndexToNextStation(int station)
    {
        int target = station * 560;
        int position = Approach(Feedback.TrackMm, target, 8);
        Feedback = Feedback with { TrackMm = position, Indexing = position != target };
        return position == target;
    }

    public bool FinishCarton()
    {
        bool accepted = Feedback.Inspection == SealResult.Pass;
        if (!accepted)
        {
            Feedback = Feedback with { Rejected = Feedback.Rejected + 1 };
        }

        return accepted;
    }
}
