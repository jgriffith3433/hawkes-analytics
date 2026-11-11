using System.Collections.Generic;
using Hawkes;
using UnityEngine;

// Hawkes Analytics recipe: the four first-session events from a Unity WebGL game.
// Put this on any GameObject, then call the three methods from your game where those moments happen.
public class HawkesRecipe : MonoBehaviour
{
    const string Level = "1";

    void Start()
    {
        // The player can play: the title screen is up and answers input.
        HawkesAnalytics.Ready();
    }

    // A level begins (call it again for each attempt).
    public void OnLevelBegan()
    {
        HawkesAnalytics.LevelStart(Level);
    }

    // The player dies. The level ends with it, so the funnel sees where players give up.
    public void OnPlayerDied(string cause)
    {
        HawkesAnalytics.Death(cause, new Dictionary<string, object> { { "where", "bridge" } });
        HawkesAnalytics.LevelEnd(Level, "death");
    }

    // The player finishes the level.
    public void OnLevelFinished(int score)
    {
        HawkesAnalytics.LevelEnd(Level, "complete", new Dictionary<string, object> { { "score", score } });
    }
}
