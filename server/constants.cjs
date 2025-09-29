const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'state.json')
const VOID_STATE_FILE = path.join(DATA_DIR, 'void-state.json')
const REPO_ROOT = path.join(__dirname, '..')
const VOID_SCRIPT = path.join(REPO_ROOT, 'scripts', 'void_service.py')
const OPENAI_MODELS_PATH = path.join(__dirname, 'openai-models.json')
const OPENAI_MODELS_API_URL = 'https://api.openai.com/v1/models?limit=1000'
const OPENAI_MODELS_CACHE_TTL_MS = 1000 * 60 * 30

const DEFAULT_MANAGER_CONFIG = {
  capacity: 64,
  base_ttl: 120,
  decay_half_life: 8,
  prune_sample: 32,
  prune_target_ratio: 0.4,
  recency_half_life_ticks: 32,
  habituation_start: 16,
  habituation_scale: 1.0,
  boredom_weight: 0.35,
  frontier_novelty_threshold: 0.7,
  frontier_patience: 3,
  diffusion_interval: 12,
  diffusion_kappa: 0.25,
  exploration_churn_window: 32
}

module.exports = {
  DATA_DIR,
  DATA_FILE,
  VOID_STATE_FILE,
  REPO_ROOT,
  VOID_SCRIPT,
  OPENAI_MODELS_PATH,
  OPENAI_MODELS_API_URL,
  OPENAI_MODELS_CACHE_TTL_MS,
  DEFAULT_MANAGER_CONFIG
}
