import { readdir, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";

const ROOT = join(import.meta.dir, "..");
const DATABASE_DIR = join(ROOT, "database");
const APP_DIR = join(ROOT, "app");

interface Provider {
  key: string;
  name: string;
  logo: string;
}

interface Model {
  model: string;
  tags: string[];
  inputPricePerMtok: number;
  outputPricePerMtok: number;
  contextWindow: number;
  outputTokenLimit: number;
}

interface ModelWithProvider extends Model {
  provider: string;
}

interface ModelRef {
  provider: string;
  model: string;
}

interface AppConfig {
  recommendedModel?: Record<string, ModelRef[]>;
  recommendedCheapest?: ModelRef[];
  recommendedBalanced?: ModelRef[];
  recommendedSmartest?: ModelRef[];
}

const loadProviders = async (): Promise<Provider[]> => {
  const file = Bun.file(join(DATABASE_DIR, "providers.json"));
  return file.json();
};

const loadModels = async (): Promise<ModelWithProvider[]> => {
  const modelsDir = join(DATABASE_DIR, "models");
  const files = await readdir(modelsDir);
  const models: ModelWithProvider[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const provider = basename(file, ".json");
    const content: Model[] = await Bun.file(join(modelsDir, file)).json();
    models.push(...content.map((m) => ({ ...m, provider })));
  }

  return models;
};

const loadAppConfigs = async (): Promise<Map<string, AppConfig>> => {
  const appsDir = join(DATABASE_DIR, "apps");
  const files = await readdir(appsDir);
  const configs = new Map<string, AppConfig>();

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const appName = basename(file, ".json");
    const content: AppConfig = await Bun.file(join(appsDir, file)).json();
    configs.set(appName, content);
  }

  return configs;
};

const buildAppOutput = (
  providers: Provider[],
  models: ModelWithProvider[],
  appConfig: AppConfig
) => ({
  models,
  providers,
  ...appConfig,
});

const main = async () => {
  console.log("Loading database...");
  const [providers, models, appConfigs] = await Promise.all([
    loadProviders(),
    loadModels(),
    loadAppConfigs(),
  ]);

  console.log(`Loaded ${providers.length} providers, ${models.length} models`);

  for (const [appName, config] of appConfigs) {
    const outputDir = join(APP_DIR, appName);
    await mkdir(outputDir, { recursive: true });

    const output = buildAppOutput(providers, models, config);
    const outputPath = join(outputDir, "v1.json");

    await Bun.write(outputPath, JSON.stringify(output, null, 2) + "\n");
    console.log(`Generated: ${outputPath}`);
  }

  console.log("Build complete!");
};

main().catch(console.error);
