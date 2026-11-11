# Unity compile fixture

Minimal Unity 6 project (`6000.3.7f1`) that references `Packages/com.hawkes.analytics` by local
`file:` path. Hawkes Gen's compile-only check (`unity.build` with `check: true`) opens this folder,
imports the package, `Assets/CompileProbe` and `Assets/BasicEvents` (symlink to `Samples~/BasicEvents`),
and fails with file and line on a C# error.

GitHub CI still compiles Runtime + Samples against `DevTools/CompileCheck` (no Unity licence). Studio's
in-sandbox Roslyn check (`/opt/unity-check`) reads changed `.cs` files before a pull request opens.
