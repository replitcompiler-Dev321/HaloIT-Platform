/**
 * Azure DeepSeek-v4-Pro Integration
 * Full AI model integration for system-wide features
 */

const axios = require('axios');

class AzureDeepSeekAI {
  constructor() {
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://willemhattingh-8180-resource.openai.azure.com/openai/v1';
    this.apiKey = process.env.AZURE_OPENAI_API_KEY || 'REDACTED_AZURE_OPENAI_API_KEY';
    this.model = 'deepseek-v4-pro';
    this.client = this.initializeClient();
  }

  initializeClient() {
    return axios.create({
      baseURL: this.endpoint,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * General chat completion
   */
  async chat(messages, options = {}) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP || 0.95,
      });

      return {
        success: true,
        content: response.data.choices[0]?.message?.content,
        usage: response.data.usage,
        fullResponse: response.data,
      };
    } catch (error) {
      console.error('Azure DeepSeek API Error:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Code generation/modification
   */
  async generateCode(prompt, language = 'javascript', context = '') {
    const systemPrompt = `You are an expert ${language} developer. Generate clean, production-ready code.
If modifying existing code, provide the complete modified version.
Always include comments explaining the logic.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${context}\n\nRequest: ${prompt}` },
    ];

    return this.chat(messages, { temperature: 0.3, maxTokens: 8192 });
  }

  /**
   * SQL query generation and troubleshooting
   */
  async generateSQL(prompt, schema = '') {
    const systemPrompt = `You are an expert SQL developer. Generate optimized SQL queries.
Always explain the query logic.
If troubleshooting, provide detailed analysis.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Database Schema:\n${schema}\n\nRequest: ${prompt}` },
    ];

    return this.chat(messages, { temperature: 0.2, maxTokens: 4096 });
  }

  /**
   * System feature recommendation
   */
  async recommendFeature(description, context = '') {
    const systemPrompt = `You are a system architect. Provide technical recommendations for new features.
Focus on implementation approach, architecture patterns, and integration points.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `System Context:\n${context}\n\nFeature Request: ${description}` },
    ];

    return this.chat(messages, { temperature: 0.6, maxTokens: 2048 });
  }

  /**
   * Debug assistance
   */
  async debugCode(errorMessage, codeSnippet, context = '') {
    const systemPrompt = `You are an expert debugger. Analyze errors and provide solutions.
Be specific about root causes and fix approaches.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Error: ${errorMessage}\n\nCode:\n${codeSnippet}\n\nContext: ${context}` },
    ];

    return this.chat(messages, { temperature: 0.3, maxTokens: 2048 });
  }

  /**
   * Document generation
   */
  async generateDocumentation(code, type = 'api') {
    const systemPrompt = `You are a technical documentation expert. Generate clear, comprehensive documentation.
Include examples where applicable.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate ${type} documentation for:\n${code}` },
    ];

    return this.chat(messages, { temperature: 0.4, maxTokens: 2048 });
  }

  /**
   * Update API configuration
   */
  async updateConfig(newEndpoint, newApiKey) {
    this.endpoint = newEndpoint;
    this.apiKey = newApiKey;
    this.client = this.initializeClient();
    return { success: true, message: 'Configuration updated' };
  }
}

module.exports = new AzureDeepSeekAI();
