"""Bridge process that exposes the Python VoidMemoryManager over stdio."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterator, Optional, Tuple

from src.void_dynamics.manager import VoidMemoryManager

STATE_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('server/data/void-state.json')


def load_manager(config: Dict[str, Any]) -> VoidMemoryManager:
    """Load the persisted manager or instantiate one from the provided config."""

    if STATE_PATH.exists():
        loaded = VoidMemoryManager.load_json(str(STATE_PATH))
        if loaded is not None:
            return loaded

    return VoidMemoryManager(
        capacity=config['capacity'],
        base_ttl=config['base_ttl'],
        decay_half_life=config['decay_half_life'],
        prune_sample=config['prune_sample'],
        prune_target_ratio=config['prune_target_ratio'],
        recency_half_life_ticks=config['recency_half_life_ticks'],
        habituation_start=config['habituation_start'],
        habituation_scale=config['habituation_scale'],
        boredom_weight=config['boredom_weight'],
        frontier_novelty_threshold=config['frontier_novelty_threshold'],
        frontier_patience=config['frontier_patience'],
        diffusion_interval=config['diffusion_interval'],
        diffusion_kappa=config['diffusion_kappa'],
        exploration_churn_window=config['exploration_churn_window'],
    )


def persist_manager(manager: VoidMemoryManager) -> None:
    """Persist the current manager state to disk."""

    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    manager.save_json(str(STATE_PATH))


def register_and_reinforce(manager: VoidMemoryManager, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Register incoming memories and apply optional reinforcement."""

    ids = payload['ids']
    texts = payload['texts']
    reinforce = payload.get('reinforce', {})
    heat_gain = payload.get('heat_gain', 0.5)
    ttl_boost = payload.get('ttl_boost', 60)

    manager.register_chunks(ids=ids, raw_texts=texts)

    if reinforce:
        results_payload: Dict[str, Any] = {}
        if 'ids' in reinforce:
            results_payload['ids'] = reinforce['ids']
        if 'distances' in reinforce:
            results_payload['distances'] = reinforce['distances']

        manager.reinforce(
            results=results_payload,
            heat_gain=heat_gain,
            ttl_boost=ttl_boost,
        )

    persist_manager(manager)

    return {
        'stats': manager.stats(),
        'events': manager.consume_events(),
        'top': manager.top(5),
    }


def iter_requests() -> Iterator[str]:
    """Yield newline-delimited payloads from stdin."""

    for raw_line in sys.stdin:
        if line := raw_line.strip():
            yield line


def ensure_manager(
    manager: Optional[VoidMemoryManager],
    cached_config_hash: Optional[str],
    config: Dict[str, Any],
) -> Tuple[VoidMemoryManager, str]:
    """Ensure a manager instance exists for the provided configuration."""

    config_hash = json.dumps(config, sort_keys=True)
    if manager is not None and cached_config_hash == config_hash:
        return manager, config_hash

    return load_manager(config), config_hash


def main() -> None:
    """Entry point that dispatches commands from the Node bridge."""

    manager: Optional[VoidMemoryManager] = None
    cached_config_hash: Optional[str] = None

    for raw_payload in iter_requests():
        try:
            payload = json.loads(raw_payload)
        except json.JSONDecodeError as exc:
            print(json.dumps({'error': f'Invalid JSON payload: {exc}'}), flush=True)
            continue

        command = payload.get('command')

        if command == '__shutdown__':
            print(json.dumps({'ok': True, 'command': '__shutdown__'}), flush=True)
            return

        config = payload.get('config')
        if not isinstance(config, dict):
            print(json.dumps({'error': 'Missing manager configuration'}), flush=True)
            continue

        try:
            manager, cached_config_hash = ensure_manager(manager, cached_config_hash, config)
        except Exception as exc:  # pragma: no cover - defensive guard
            print(json.dumps({'error': f'Failed to initialize manager: {exc}'}), flush=True)
            continue

        try:
            if command == 'register':
                result = register_and_reinforce(manager, payload)
            else:
                result = {'error': f'Unsupported command: {command}'}
        except Exception as exc:  # pragma: no cover - defensive guard
            result = {'error': f'Void manager error: {exc}'}

        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
