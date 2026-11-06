using System.Collections.Generic;
using UnityEngine;

namespace Hawkes.Analytics.Samples
{
    /// <summary>
    /// Hawkes Analytics, first events. Three buttons each send one event through HawkesAnalytics, and every call is
    /// written to the list on screen, newest first, so you see what went out. Drawn with IMGUI: no Canvas, no
    /// EventSystem and no packages beyond Hawkes Analytics.
    /// In the Editor and outside WebGL nothing is sent (the list still fills). In a WebGL build with a Product set in
    /// Resources/HawkesAnalyticsSettings the same calls reach Hawkes Studio's Analytics tab.
    /// </summary>
    public class HawkesAnalyticsSample : MonoBehaviour
    {
        const int MaxLines = 12;
        readonly List<string> lines = new List<string>();
        int sent;

        void Start()
        {
            HawkesAnalytics.Screen("sample_scene");
            Add("screen", "sample_scene");
        }

        void OnGUI()
        {
            float scale = Mathf.Max(1f, Screen.height / 540f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1f));
            float w = Mathf.Min(460f, Screen.width / scale - 24f);
            GUILayout.BeginArea(new Rect(12, 12, w, Screen.height / scale - 24f));
            GUILayout.Label("Hawkes Analytics: your first events");
            GUILayout.Label("Press a button. The call is sent and listed below.");

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Track\nsample_button_pressed", GUILayout.Height(44)))
            {
                HawkesAnalytics.Track("sample_button_pressed", new Dictionary<string, object> { { "n", sent + 1 } });
                Add("track", "sample_button_pressed");
            }
            if (GUILayout.Button("Feature\nsample_feature", GUILayout.Height(44)))
            {
                HawkesAnalytics.Feature("sample_feature");
                Add("feature", "sample_feature");
            }
            if (GUILayout.Button("Level\nstart + end", GUILayout.Height(44)))
            {
                HawkesAnalytics.LevelStart("sample_level");
                HawkesAnalytics.LevelEnd("sample_level", "complete");
                Add("levelStart + levelEnd", "sample_level complete");
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8);
            GUILayout.Label(sent == 0 ? "Events sent: none yet" : "Events sent: " + sent);
            if (lines.Count == 0) GUILayout.Label("Nothing yet. Press a button.");
            for (int i = lines.Count - 1; i >= 0; i--) GUILayout.Label(lines[i]);
            GUILayout.EndArea();
        }

        void Add(string call, string detail)
        {
            sent++;
            lines.Add("#" + sent + "  " + call + "  " + detail);
            if (lines.Count > MaxLines) lines.RemoveAt(0);
        }
    }
}
