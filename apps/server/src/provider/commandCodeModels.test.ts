import { describe, expect, it } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/unstable/process";

import { CommandCodeSettings } from "@t3tools/contracts";

import { checkCommandCodeProvider, parseCommandCodeVersion } from "./CommandCodeProvider.ts";
import { parseCommandCodeModelList } from "./commandCodeModels.ts";

const decodeCommandCodeSettings = Schema.decodeSync(CommandCodeSettings);
const encoder = new TextEncoder();

const VERSION_STDOUT = "1.53.0\n";
const MODELS_STDOUT =
  "Available models  ·  2 models\n\nOpen Source\n\n" +
  "deepseek/deepseek-v4-flash   fast hybrid-attention reasoning (default)\n" +
  "z-ai/glm-5.3-flash           fast, affordable GLM coding with 1M context\n";

function spawnerLayerFor(
  handler: (args: ReadonlyArray<string>) => {
    readonly stdout?: string;
    readonly stderr?: string;
    readonly code?: number;
  },
) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      const cmd = command as unknown as { readonly args: ReadonlyArray<string> };
      const result = handler(cmd.args);
      return Effect.succeed(
        ChildProcessSpawner.makeHandle({
          pid: ChildProcessSpawner.ProcessId(1),
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result.code ?? 0)),
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          unref: Effect.succeed(Effect.void),
          stdin: Sink.drain,
          stdout: Stream.make(encoder.encode(result.stdout ?? "")),
          stderr: Stream.make(encoder.encode(result.stderr ?? "")),
          all: Stream.empty,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
        }),
      );
    }),
  );
}

const missingBinaryLayer = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make(() =>
    Effect.fail(
      PlatformError.systemError({
        _tag: "NotFound",
        module: "ChildProcess",
        method: "spawn",
        description: "spawn command-code ENOENT",
      }),
    ),
  ),
);

function runProbe(
  config: { readonly enabled: boolean; readonly binaryPath?: string },
  layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>,
) {
  return checkCommandCodeProvider({
    config: decodeCommandCodeSettings(config),
    env: {},
  }).pipe(Effect.provide(layer), Effect.runPromise);
}

const SAMPLE_LIST = `Available models  ·  3 models

Open Source

deepseek/deepseek-v4-flash   fast hybrid-attention reasoning (default)
z-ai/glm-5.3-flash           fast, affordable GLM coding with 1M context

Anthropic

claude-sonnet-5   best combo of speed & intelligence (recommended)
`;

/**
 * Verbatim `command-code --list-models` capture (70 models, 1.53.0): every
 * category header plus the trailing `Pass the full id …` / `cmd --model …` /
 * `Docs:` footer the old parser leaked into the snapshot.
 */
const REAL_LIST_MODELS_OUTPUT = `Available models  ·  70 models

Open Source

deepseek/deepseek-v4-pro               hybrid-attention long-context reasoning
deepseek/deepseek-v4-flash             fast hybrid-attention reasoning (default)
deepseek/deepseek-v4-flash-vision-exp  fast hybrid-attention reasoning with vision
deepseek/deepseek-v4-flash-fast        low-latency V4 Flash deployment
deepseek/deepseek-v4.1-flash           V4.1 hybrid-attention reasoning with vision
moonshotai/kimi-k3                     long-horizon coding & knowledge work with 1M context
moonshotai/kimi-k2.7-code              improved long-horizon coding with vision
moonshotai/kimi-k2.7-code-highspeed    high-speed long-horizon coding with vision
moonshotai/kimi-k2.6                   long-horizon coding with vision
moonshotai/kimi-k2.5                   multimodal frontend coding
z-ai/glm-5.3-flash                     fast, affordable GLM coding with 1M context
zai-org/glm-5.3                        frontier coding with emergent cyber capabilities
zai-org/glm-5.2                        powerful coding with 1M context and long-horizon tasks
zai-org/glm-5.2-fast                   high-throughput GLM-5.2 with 1M context
zai-org/glm-5.1                        long-horizon autonomous coding agent
zai-org/glm-5                          multi-mode thinking & long-range planning
minimaxai/minimax-m3                   frontier coding, agents & native multimodality
minimaxai/minimax-m2.7                 end-to-end software engineering agent
minimaxai/minimax-m2.5                 cross-platform full-stack agentic dev
xiaomi/mimo-v2.5-pro                   high-capability long-context agentic coding
xiaomi/mimo-v2.5                       efficient long-context agentic coding
qwen/qwen3.8-max-0902                  upgraded Qwen 3.8 Max: stronger coding & agentic tool use
qwen/qwen3.8-max                       autonomous long-horizon coding & professional work
qwen/qwen3.8-27b                       compact vision-language coding & agentic work
qwen/qwen3.8-flash                     fast low-cost agentic coding & reasoning
qwen/qwen3.7-max                       frontier coding & long-horizon agent execution
qwen/qwen3.7-plus                      agentic coding & reasoning at lower cost
qwen/qwen3.7-flash                     fast low-cost agentic coding & reasoning
qwen/qwen3.6-max-preview               vibe coding & efficient agent execution
qwen/qwen3.6-plus                      agentic coding & reasoning
meituan/longcat-2.0:free               FREE trillion-parameter agentic coding with 1M context
stepfun/step-3.7-flash                 multimodal sparse-MoE reasoning
stepfun/step-3.5-flash                 fast sparse-MoE agentic reasoning
tencent/hy3-paid                       sparse-MoE reasoning & agentic tool use
tencent/hy4-preview                    agentic coding & sustained multi-step tool use
nvidia/nemotron-3-ultra-550b-a55b      open reasoning model for long-horizon autonomous agents
thinkingmachines/inkling               multimodal MoE reasoning
thinkingmachines/inkling-small         lightweight MoE reasoning at lower cost and latency
poolside/laguna-s-2.1-free             FREE open-weight agentic coding and long-horizon work
inclusionai/ling-3.0-flash-sante:free  FREE health & medicine tuned lightweight-MoE, still strong on code

Anthropic

claude-sonnet-5                        best combo of speed & intelligence (recommended)
claude-sonnet-4-6                      prev Sonnet, still fast & capable
claude-fable-5-1                       most capable for demanding reasoning & long-horizon agents
claude-fable-5                         prev Fable, still strong for deep reasoning & agents
claude-opus-5                          most intelligent Opus for agents and coding
claude-opus-4-8                        prev flagship, still strong for agents and coding
claude-opus-4-7                        older Opus, still strong for agents and coding
claude-haiku-4-5                       fastest & most compact, great for quick tasks

OpenAI

gpt-6-astra                            most capable OpenAI model for demanding reasoning & agents
gpt-5.6-sol                            frontier model for complex professional work
gpt-5.6-terra                          balances intelligence and cost
gpt-5.6-luna                           optimized for cost-sensitive workloads
gpt-5.5                                latest frontier model for general complex work
gpt-5.4                                frontier model for general complex work
gpt-5.3-codex                          frontier coding model
gpt-5.4-mini                           fast, cost-effective model for everyday tasks

Google

google/gemini-3.8-flash                newest Gemini Flash, improved core reasoning
google/gemini-3.7-flash                higher-quality coding & agentic workflows, fewer tokens
google/gemini-3.6-flash                previous Gemini Flash, still fast & capable
google/gemini-3.5-flash                Pro-level coding proficiency, parallel agentic execution
google/gemini-3.5-flash-lite           upgraded agentic capabilities, ideal for subagents
google/gemini-3.1-flash-lite           high-volume workhorse model with implicit caching

Sakana

sakana/fugu-ultra                      multi-agent orchestration across frontier models

Meta

meta/muse-spark-1.1                    agentic performance, tool use, and computer use
meta/muse-spark-1.2                    coding-optimized for agentic workflows and large codebases
meta/muse-spark-1.2-contributor        Muse Spark 1.2 at ~95% off
meta/muse-spark-1.3                    multimodal reasoning for long-horizon agentic and coding workflows
meta/muse-spark-1.3-contributor        Muse Spark 1.3 at up to 95% off

xAI

xai/grok-4.5                           smartest model for coding, agentic tasks, knowledge work
xai/grok-4.6                           frontier performance on coding, knowledge work, and STEM

Pass the full id, or just the short name after the last "/":
cmd --model moonshotai/kimi-k2.5
cmd --model kimi-k2.5

Docs:  https://commandcode.ai/docs/reference/cli/models
`;

describe("parseCommandCodeModelList", () => {
  it("parses slugs and drops category headers", () => {
    const models = parseCommandCodeModelList(SAMPLE_LIST);
    expect(models.map((model) => model.slug)).toEqual([
      "deepseek/deepseek-v4-flash",
      "z-ai/glm-5.3-flash",
      "claude-sonnet-5",
    ]);
    expect(models.every((model) => model.isCustom === false && model.capabilities === null)).toBe(
      true,
    );
  });

  it("marks the explicitly-default row, not the first row", () => {
    const models = parseCommandCodeModelList(SAMPLE_LIST);
    expect(models.find((model) => model.isDefault === true)?.slug).toBe(
      "deepseek/deepseek-v4-flash",
    );
  });

  it("falls back to the first row as default when no row is marked", () => {
    const models = parseCommandCodeModelList(SAMPLE_LIST.replace("(default)", "(recommended)"));
    expect(models.find((model) => model.isDefault === true)?.slug).toBe(
      "deepseek/deepseek-v4-flash",
    );
  });

  it("tolerates ANSI colors and windows line endings", () => {
    const models = parseCommandCodeModelList(
      "\u001b[32mdeepseek/deepseek-v4-flash\u001b[39m   hybrid-attention (default)\r\n" +
        "claude-sonnet-5   recommended\r\n",
    );
    expect(models.map((model) => model.slug)).toEqual([
      "deepseek/deepseek-v4-flash",
      "claude-sonnet-5",
    ]);
  });

  it("returns an empty list for garbage output", () => {
    expect(parseCommandCodeModelList("")).toEqual([]);
    expect(parseCommandCodeModelList("Anthropic\n\nOpen Source\n")).toEqual([]);
  });

  it("drops the mixed-case xAI header", () => {
    const models = parseCommandCodeModelList(
      "xAI\n\nxai/grok-4.5   smartest model for coding\nxai/grok-4.6   frontier performance\n",
    );
    expect(models.map((model) => model.slug)).toEqual(["xai/grok-4.5", "xai/grok-4.6"]);
  });

  it("keeps lowercase bare slugs while dropping single-token headers", () => {
    const models = parseCommandCodeModelList(
      "Anthropic\n\nclaude-sonnet-5   best combo of speed & intelligence (recommended)\n",
    );
    expect(models.map((model) => model.slug)).toEqual(["claude-sonnet-5"]);
  });

  it("drops the trailing usage/footer lines of the real catalog", () => {
    const models = parseCommandCodeModelList(
      [
        "Available models  ·  70 models",
        "",
        "Open Source",
        "",
        "deepseek/deepseek-v4-flash             fast hybrid-attention reasoning (default)",
        "",
        "xAI",
        "",
        "xai/grok-4.5                           smartest model for coding",
        "",
        'Pass the full id, or just the short name after the last "/":',
        "cmd --model moonshotai/kimi-k2.5",
        "cmd --model kimi-k2.5",
        "",
        "Docs:  https://commandcode.ai/docs/reference/cli/models",
        "",
      ].join("\n"),
    );
    expect(models.map((model) => model.slug)).toEqual([
      "deepseek/deepseek-v4-flash",
      "xai/grok-4.5",
    ]);
    expect(models.find((model) => model.isDefault === true)?.slug).toBe(
      "deepseek/deepseek-v4-flash",
    );
  });

  it("parses the real 70-model catalog: all headers and footers dropped", () => {
    const models = parseCommandCodeModelList(REAL_LIST_MODELS_OUTPUT);
    expect(models).toHaveLength(70);
    expect(models.every((model) => !/[A-Z]/.test(model.slug))).toBe(true);
    expect(models.map((model) => model.slug)).toContain("xai/grok-4.5");
    expect(models.map((model) => model.slug)).toContain("meituan/longcat-2.0:free");
    expect(models.find((model) => model.isDefault === true)?.slug).toBe(
      "deepseek/deepseek-v4-flash",
    );
  });
});

describe("checkCommandCodeProvider probe failures", () => {
  it("falls back to the PATH binary when binaryPath is blank and reports ready", async () => {
    const seen: Array<ReadonlyArray<string>> = [];
    const snapshot = await runProbe(
      { enabled: true, binaryPath: "" },
      spawnerLayerFor((args) => {
        seen.push(args);
        return args[0] === "--version" ? { stdout: VERSION_STDOUT } : { stdout: MODELS_STDOUT };
      }),
    );
    // `makeBinaryPathSetting` decodes "" to the "command-code" fallback, so
    // the provider resolves an empty Binary path without throwing.
    expect(snapshot.status).toBe("ready");
    expect(snapshot.installed).toBe(true);
    expect(snapshot.version).toBe("1.53.0");
    expect(snapshot.models).toHaveLength(2);
    expect(seen.map((args) => args[0])).toEqual(["--version", "--list-models"]);
  });

  it("reports a not-installed error snapshot when the binary is missing", async () => {
    const snapshot = await runProbe({ enabled: true }, missingBinaryLayer);
    expect(snapshot.status).toBe("error");
    expect(snapshot.installed).toBe(false);
    expect(snapshot.models).toEqual([]);
    expect(snapshot.message).toMatch(/could not be started/);
  });

  it("reports a not-installed error snapshot when --version exits nonzero", async () => {
    const snapshot = await runProbe(
      { enabled: true },
      spawnerLayerFor(() => ({ stdout: "", stderr: "boom", code: 1 })),
    );
    expect(snapshot.status).toBe("error");
    expect(snapshot.installed).toBe(false);
    expect(snapshot.models).toEqual([]);
  });

  it("reports a not-installed error snapshot on a wrapper that echoes then fails", async () => {
    // A wrapper that prints junk to stdout but exits nonzero is not ready —
    // the probe must not fall through to version parsing.
    const snapshot = await runProbe(
      { enabled: true },
      spawnerLayerFor(() => ({ stdout: "1.53.0\n", stderr: "wrapper failed", code: 2 })),
    );
    expect(snapshot.status).toBe("error");
    expect(snapshot.installed).toBe(false);
    expect(snapshot.version).toBeNull();
  });

  it("reports an error snapshot when --version has no parseable semver", async () => {
    const snapshot = await runProbe(
      { enabled: true },
      spawnerLayerFor((args) =>
        args[0] === "--version"
          ? { stdout: "command code, dev build\n" }
          : { stdout: MODELS_STDOUT },
      ),
    );
    expect(snapshot.status).toBe("error");
    expect(snapshot.installed).toBe(true);
    expect(snapshot.version).toBeNull();
    expect(snapshot.message).toMatch(/without a version/);
  });

  it("reports a warning snapshot when --list-models exits nonzero", async () => {
    const snapshot = await runProbe(
      { enabled: true },
      spawnerLayerFor((args) =>
        args[0] === "--version"
          ? { stdout: VERSION_STDOUT }
          : { stdout: "", stderr: "denied", code: 3 },
      ),
    );
    expect(snapshot.status).toBe("warning");
    expect(snapshot.installed).toBe(true);
    expect(snapshot.version).toBe("1.53.0");
    expect(snapshot.models).toEqual([]);
    expect(snapshot.message).toMatch(/model list could not be read/);
  });

  it("picks the last semver out of an auto-update banner", () => {
    expect(parseCommandCodeVersion("Updating…\ncommand-code 1.52.0 → 1.53.0\n1.53.0\n")).toBe(
      "1.53.0",
    );
    expect(parseCommandCodeVersion("no version here")).toBeNull();
  });
});
