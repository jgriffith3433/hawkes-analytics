// Compile-only probe: pulls the package API (and the same UnityEngine surface the Basic events sample uses)
// into this fixture so Hawkes Gen's compile-only check and a local Editor open both reject a broken package.
using System.Collections.Generic;
using Hawkes;
using UnityEngine;

namespace Hawkes.Analytics.CompileProbe
{
    public sealed class CompileProbe : MonoBehaviour
    {
        void Start()
        {
            HawkesAnalytics.Screen("compile_probe");
            HawkesAnalytics.Track("compile_probe_ok", new Dictionary<string, object> { { "n", 1 } });
            HawkesAnalytics.Feature("compile_probe");
            HawkesAnalytics.LevelStart("1");
            HawkesAnalytics.LevelEnd("1", "complete");
            // Same UnityEngine surface the Basic events sample touches (keeps Gen's compile on that path).
            float scale = Mathf.Max(1f, Screen.height / 540f);
            var _ = Matrix4x4.Scale(new Vector3(scale, scale, 1f));
        }
    }
}
