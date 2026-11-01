// Just enough of UnityEngine for CI to compile the package's Runtime with plain .NET (no Unity licence). It mirrors the
// signatures the package uses; add to it when the package uses more. Studio's Unity build is the real check.
using System;

namespace UnityEngine
{
    public class Object { }
    public class ScriptableObject : Object { }
    public struct Vector2 { public float x, y; }
    public struct Vector3 { public float x, y, z; }
    public enum LogType { Error, Assert, Warning, Log, Exception }
    public static class Debug
    {
        public static void Log(object message) { }
        public static void LogWarning(object message) { }
    }
    public static class Application
    {
        public delegate void LogCallback(string condition, string stackTrace, LogType type);
        public static event LogCallback logMessageReceived { add { } remove { } }
        public static string version => "0.0.0";
    }
    public static class Resources
    {
        public static T Load<T>(string path) where T : Object => null;
    }
    public enum RuntimeInitializeLoadType { AfterSceneLoad, BeforeSceneLoad }
    [AttributeUsage(AttributeTargets.Method)]
    public class RuntimeInitializeOnLoadMethodAttribute : Attribute
    {
        public RuntimeInitializeOnLoadMethodAttribute() { }
        public RuntimeInitializeOnLoadMethodAttribute(RuntimeInitializeLoadType loadType) { }
    }
    [AttributeUsage(AttributeTargets.Class)]
    public class CreateAssetMenuAttribute : Attribute
    {
        public string menuName { get; set; }
        public string fileName { get; set; }
        public int order { get; set; }
    }
    [AttributeUsage(AttributeTargets.Field)]
    public class TooltipAttribute : Attribute
    {
        public TooltipAttribute(string tooltip) { }
    }
}
