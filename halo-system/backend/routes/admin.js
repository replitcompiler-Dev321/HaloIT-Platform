const express = require('express');
const { body, validationResult } = require('express-validator');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sequelize } = require('../db/models');
const { handleAiAction, updateAiSettings, getAiSettings } = require('../ai/aiService');
const auditService = require('../services/audit');

const router = express.Router();

const expansionModules = [
  {
    id: 'rmm',
    name: 'RMM Monitoring',
    description: 'Remote monitoring and management for connected devices.',
    enabled: false,
    details: 'Lightweight device metrics, alerts, and summaries for prototype deployment.',
  },
  {
    id: 'accounting',
    name: 'Accounting Suite',
    description: 'Basic finance workspace for invoices, billing, and reports.',
    enabled: false,
    details: 'Includes invoice generator, simple billing dashboard, and export stub.',
  },
  {
    id: 'learning',
    name: 'Learning Center',
    description: 'Knowledge hub, tutorials, and AI-guided learning resources.',
    enabled: false,
    details: 'Built for AI-assisted learning and system onboarding.',
  },
];

function findExpansion(id) {
  return expansionModules.find((module) => module.id === id);
}

function runShellCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        return reject({ error: error.message, stdout: stdout || '', stderr: stderr || '' });
      }
      resolve({ output: stdout || stderr || 'Command executed successfully' });
    });
  });
}

router.get('/expansions', authenticate, requireRole('super_admin'), async (req, res) => {
  res.json({ success: true, expansions: expansionModules });
});

router.post('/expansions/:id/enable', authenticate, requireRole('super_admin'), async (req, res) => {
  const { id } = req.params;
  const module = findExpansion(id);
  if (!module) {
    return res.status(404).json({ error: 'Expansion not found' });
  }
  module.enabled = true;
  await auditService.log(req, 'expansion_enabled', 'expansions', null, { id });
  res.json({ success: true, expansion: module });
});

router.post('/expansions/:id/configure', authenticate, requireRole('super_admin'), async (req, res) => {
  const { id } = req.params;
  const module = findExpansion(id);
  if (!module) {
    return res.status(404).json({ error: 'Expansion not found' });
  }
  const updates = req.body || {};
  Object.assign(module, updates);
  await auditService.log(req, 'expansion_configured', 'expansions', null, { id, updates });
  res.json({ success: true, expansion: module });
});

router.post('/apps/generate', authenticate, requireRole('super_admin'), [
  body('name').isString().trim().notEmpty(),
  body('description').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const targetDir = path.resolve(__dirname, '../generated-apps', sanitized);

    if (fs.existsSync(targetDir)) {
      return res.status(400).json({ error: 'App folder already exists' });
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, 'README.md'),
      `# ${name}

${description || 'Generated app workspace.'}

## Notes
- This app was created from the Halo Admin App Creation Center.
- Use this folder as a starting point for custom development.
`
    );
    fs.writeFileSync(
      path.join(targetDir, 'index.js'),
      `console.log('Welcome to the generated app ${name}');\n`
    );
    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          name: sanitized,
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
          },
        },
        null,
        2
      )
    );

    await auditService.log(req, 'app_generated', 'apps', null, { name, path: targetDir });
    res.json({ success: true, message: 'App scaffold created', location: `/generated-apps/${sanitized}` });
  } catch (error) {
    await auditService.logFailure(req, 'app_generate_failed', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/terminal', authenticate, requireRole('super_admin'), [
  body('command').isString().trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { command } = req.body;
    const result = await runShellCommand(command);
    await auditService.log(req, 'terminal_command', null, null, { command });
    res.json({ success: true, output: result.output });
  } catch (error) {
    await auditService.logFailure(req, 'terminal_command_failed', error.error || error.message);
    res.status(500).json({ error: error.error || error.message, output: error.stdout || '' });
  }
});

router.post('/sql', authenticate, requireRole('super_admin'), [
  body('query').isString().trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query } = req.body;
    const trimmed = query.trim().toLowerCase();
    const isSelect = trimmed.startsWith('select');
    const result = await sequelize.query(query, {
      type: isSelect ? QueryTypes.SELECT : QueryTypes.RAW,
    });

    await auditService.log(req, 'sql_executed', null, null, { query });
    res.json({ success: true, result });
  } catch (error) {
    await auditService.logFailure(req, 'sql_execution_failed', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai/settings', authenticate, requireRole('super_admin'), (req, res) => {
  res.json({ success: true, settings: getAiSettings() });
});

router.put('/ai/config', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const updates = req.body;
    updateAiSettings(updates);
    await auditService.log(req, 'ai_config_updated', null, null, { updates });
    res.json({ success: true, message: 'AI configuration updated', settings: getAiSettings() });
  } catch (error) {
    await auditService.logFailure(req, 'ai_config_update_failed', error.message);
    res.status(400).json({ error: error.message });
  }
});

router.post('/ai/code', authenticate, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await handleAiAction('developer', { prompt });
    await auditService.log(req, 'ai_code_requested', null, null, { prompt });
    res.json({ success: true, content: result.reply, provider: result.provider, raw: result.raw });
  } catch (error) {
    await auditService.logFailure(req, 'ai_code_failed', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/sql', authenticate, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await handleAiAction('developer', { prompt: `Review this SQL request and provide guidance:\n${prompt}` });
    await auditService.log(req, 'ai_sql_requested', null, null, { prompt });
    res.json({ success: true, content: result.reply, provider: result.provider, raw: result.raw });
  } catch (error) {
    await auditService.logFailure(req, 'ai_sql_failed', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/feature', authenticate, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await handleAiAction('system', { prompt: `Create or recommend a feature implementation plan based on:\n${prompt}` });
    await auditService.log(req, 'ai_feature_requested', null, null, { prompt });
    res.json({ success: true, content: result.reply, provider: result.provider, raw: result.raw });
  } catch (error) {
    await auditService.logFailure(req, 'ai_feature_failed', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
