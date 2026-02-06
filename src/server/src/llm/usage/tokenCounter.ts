import type { LogicalModel } from "../models/logicalModels";

type EncodingModule = {
  get_encoding: (name: string) => { encode: (text: string) => number[] | Uint32Array };
};

let encodingModulePromise: Promise<EncodingModule> | null = null;
let cachedEncoding: { name: string; encode: (text: string) => number[] | Uint32Array } | null = null;

const LOGICAL_MODEL_ENCODING_MAP: Record<LogicalModel, string> = {
  "gpt-5.2": "cl100k_base",
  "gpt-5.1": "cl100k_base",
  "gpt-5-mini": "cl100k_base",
  "gpt-5-nano": "cl100k_base"
};

async function getEncodingModule(): Promise<EncodingModule> {
  if (!encodingModulePromise) {
    encodingModulePromise = import("@dqbd/tiktoken") as unknown as Promise<EncodingModule>;
  }
  return encodingModulePromise;
}

async function resolveEncodingName(logicalModel: LogicalModel): Promise<string> {
  return LOGICAL_MODEL_ENCODING_MAP[logicalModel] || "cl100k_base";
}

async function getEncoding(logicalModel: LogicalModel) {
  const module = await getEncodingModule();
  const encodingName = await resolveEncodingName(logicalModel);
  if (cachedEncoding && cachedEncoding.name === encodingName) {
    return { encoding: cachedEncoding, encodingName };
  }
  const encoding = module.get_encoding(encodingName);
  cachedEncoding = { name: encodingName, encode: encoding.encode.bind(encoding) };
  return { encoding: cachedEncoding, encodingName };
}

export async function countTokensForText(opts: {
  provider: "openai" | "openrouter";
  providerModelId: string;
  logicalModel: LogicalModel;
  text: string;
}): Promise<{ tokens: number; encoding: string } | null> {
  if (!opts.text) return { tokens: 0, encoding: "cl100k_base" };
  try {
    const { encoding, encodingName } = await getEncoding(opts.logicalModel);
    const tokens = encoding.encode(opts.text).length;
    return { tokens, encoding: encodingName };
  } catch {
    return null;
  }
}

export async function countTokensForMessages(opts: {
  provider: "openai" | "openrouter";
  providerModelId: string;
  logicalModel: LogicalModel;
  messages: Array<{ role?: string; content?: string; text?: string }>;
}): Promise<{ tokens: number; encoding: string } | null> {
  const combined = messagesToCanonicalText(opts.messages);
  return countTokensForText({
    provider: opts.provider,
    providerModelId: opts.providerModelId,
    logicalModel: opts.logicalModel,
    text: combined
  });
}

export function messagesToCanonicalText(messages: Array<{ role?: string; content?: string; text?: string }>): string {
  return messages
    .map((msg) => {
      const role = msg.role ? `${msg.role}:` : "";
      const content = typeof msg.content === "string" ? msg.content : typeof msg.text === "string" ? msg.text : "";
      return `${role}${content}`;
    })
    .join("\n");
}
