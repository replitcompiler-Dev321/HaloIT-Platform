const runtimeOverrides = {
  provider: process.env.AI_PROVIDER || 'azure',
  fallbackProviders: process.env.AI_FALLBACK_PROVIDERS
    ? process.env.AI_FALLBACK_PROVIDERS.split(',').map((v) => v.trim()).filter(Boolean)
    : ['openai', 'ollama', 'mock'],
  endpoint: process.env.AI_ENDPOINT || '',
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
  temperature: Number(process.env.AI_TEMPERATURE || 0.7),
  maxTokens: Number(process.env.AI_MAX_TOKENS || 1000),
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 30000),
  apiKey: process.env.AZURE_OPENAI_API_KEY || '',
};

function getProviderConfig() {
  return {
    provider: runtimeOverrides.provider,
    fallbackProviders: runtimeOverrides.fallbackProviders,
    endpoint: runtimeOverrides.endpoint,
    model: runtimeOverrides.model,
    deployment: runtimeOverrides.deployment,
    apiVersion: runtimeOverrides.apiVersion,
    temperature: runtimeOverrides.temperature,
    maxTokens: runtimeOverrides.maxTokens,
    timeoutMs: runtimeOverrides.timeoutMs,
    azure: {
      endpoint: runtimeOverrides.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '',
      apiKey: runtimeOverrides.apiKey || process.env.AZURE_OPENAI_API_KEY || '',
      deployment: runtimeOverrides.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || '',
      apiVersion: runtimeOverrides.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
    },
    openai: {
      apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
    },
    openrouter: {
      apiUrl: process.env.OPENROUTER_API_URL || 'https://openrouter.ai/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
    },
    ollama: {
      apiUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    },
    custom: {
      apiUrl: process.env.CUSTOM_OPENAI_API_URL || '',
      apiKey: process.env.CUSTOM_OPENAI_API_KEY || '',
    },
  };
}

function getPublicSettings() {
  const config = getProviderConfig();
  return {
    provider: config.provider,
    fallbackProviders: config.fallbackProviders,
    endpoint: config.endpoint,
    model: config.model,
    deployment: config.deployment,
    apiVersion: config.apiVersion,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    azure: {
      endpoint: config.azure.endpoint,
      deployment: config.azure.deployment,
      apiVersion: config.azure.apiVersion,
      hasKey: Boolean(config.azure.apiKey),
    },
    openai: {
      apiUrl: config.openai.apiUrl,
      hasKey: Boolean(config.openai.apiKey),
    },
    openrouter: {
      apiUrl: config.openrouter.apiUrl,
      hasKey: Boolean(config.openrouter.apiKey),
    },
    ollama: {
      apiUrl: config.ollama.apiUrl,
    },
    custom: {
      apiUrl: config.custom.apiUrl,
      hasKey: Boolean(config.custom.apiKey),
    },
  };
}

function updateSettings(updates = {}) {
  if (typeof updates.provider === 'string') {
    runtimeOverrides.provider = updates.provider;
  }
  if (typeof updates.endpoint === 'string') {
    runtimeOverrides.endpoint = updates.endpoint;
  }
  if (typeof updates.model === 'string') {
    runtimeOverrides.model = updates.model;
  }
  if (typeof updates.deployment === 'string') {
    runtimeOverrides.deployment = updates.deployment;
  }
  if (typeof updates.apiVersion === 'string') {
    runtimeOverrides.apiVersion = updates.apiVersion;
  }
  if (typeof updates.temperature === 'number') {
    runtimeOverrides.temperature = updates.temperature;
  }
  if (typeof updates.maxTokens === 'number') {
    runtimeOverrides.maxTokens = updates.maxTokens;
  }
  if (typeof updates.timeoutMs === 'number') {
    runtimeOverrides.timeoutMs = updates.timeoutMs;
  }
  if (typeof updates.apiKey === 'string') {
    runtimeOverrides.apiKey = updates.apiKey;
  }
  if (typeof updates.fallbackProviders === 'string') {
    runtimeOverrides.fallbackProviders = updates.fallbackProviders
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
}

module.exports = {
  getProviderConfig,
  getPublicSettings,
  updateSettings,
};
