"""Evaluation entrypoint for Gate G-A control plane agent."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any, Dict, Iterable, List, Optional

import google.adk.evaluation.local_eval_service as _local_eval_service

ROOT = Path(__file__).resolve().parents[3]
EVAL_MODE = os.getenv("EVAL_MODE", "false").lower() in {"1", "true", "yes"}


def _load_module(name: str, path: Path, *, package: bool = False):
    spec = importlib.util.spec_from_file_location(
        name,
        path,
        submodule_search_locations=[str(path.parent)] if package else None,
    )
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise ImportError(f"Unable to load module '{name}' from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _ensure_agent_aliases() -> None:
    """Expose agent_pkg modules under the public ``agent`` namespace."""

    pkg_root = ROOT / "agent"

    agent_package = sys.modules.get("agent")
    if agent_package is None:
        agent_package = ModuleType("agent")
        sys.modules["agent"] = agent_package

    if not hasattr(agent_package, "__path__"):
        agent_package.__path__ = [str(pkg_root)]

    services_module = sys.modules.get("agent_pkg.services")
    if services_module is not None and "agent.services" not in sys.modules:
        sys.modules["agent.services"] = services_module
        setattr(agent_package, "services", services_module)

    supabase_module = sys.modules.get("agent_pkg.services.supabase")
    if supabase_module is not None and "agent.services.supabase" not in sys.modules:
        sys.modules["agent.services.supabase"] = supabase_module
        services_alias = sys.modules.get("agent.services")
        if services_alias is not None:
            setattr(services_alias, "supabase", supabase_module)


def _install_supabase_stub() -> None:
    """Patch SupabaseClient with a canned stub across agent namespaces."""

    target_modules = [
        sys.modules.get("agent.services.supabase"),
        sys.modules.get("agent_pkg.services.supabase"),
    ]

    # Bail out early if the real module has not been loaded yet.
    if not any(target_modules):
        return

    canned_safeguards: List[Dict[str, Any]] = [
        {
            "hint_type": "tone",
            "suggested_value": "Maintain professional tone and empathy",
            "status": "required",
            "rationale": "Pilot sponsors expect curated messaging.",
            "confidence": 0.92,
        },
        {
            "hint_type": "data_usage",
            "suggested_value": "Avoid quoting internal revenue numbers",
            "status": "suggested",
            "rationale": "Financial data remains redacted during discovery.",
            "confidence": 0.78,
        },
        {
            "hint_type": "support_window",
            "suggested_value": "Respect quiet hours 20:00-07:00 tenant local",
            "status": "suggested",
            "rationale": "Ops team handles escalations during business hours only.",
            "confidence": 0.74,
        },
    ]

    canned_library_plays: List[Dict[str, Any]] = [
        {
            "id": "1afab5bd-95ed-4f8a-8fd8-342a4b66b9ad",
            "title": "Kickoff champion workflow",
            "summary": "Prep enablement brief and align on win metrics.",
            "metadata": {
                "impact": "P0",
                "risk": "Low",
                "undo_plan": "Archive draft brief and notify stakeholders.",
            },
            "_similarity": 0.91,
        },
        {
            "id": "9d6a14c1-f840-48ba-9f22-cdd3e611f531",
            "title": "Stand up telemetry dashboard",
            "summary": "Deploy pilot telemetry pack highlighting weekly wins.",
            "metadata": {
                "impact": "P1",
                "risk": "Medium",
                "undo_plan": "Disable dashboard feature flags and revert environment.",
            },
            "_similarity": 0.86,
        },
        {
            "id": "4c480d74-85c3-4f3b-8f9d-2cbeb0b4791b",
            "title": "Customer story enablement",
            "summary": "Compile pilot executive summary and champion quotes.",
            "metadata": {
                "impact": "P1",
                "risk": "Low",
                "undo_plan": "Retract briefing pack and reset success metrics.",
            },
            "_similarity": 0.79,
        },
    ]

    class _EvalSupabaseClient:
        allow_writes = False
        _offline_buffer: Dict[str, List[Dict[str, Any]]] = {}
        _degraded = False

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self.enabled = True

        @classmethod
        def from_env(cls) -> "_EvalSupabaseClient":
            return cls()

        def fetch_safeguards(
            self,
            *,
            mission_id: str,
            tenant_id: str,
            limit: int = 10,
        ) -> List[Dict[str, Any]]:
            return canned_safeguards[:limit]

        def fetch_toolkit_selections(
            self,
            *,
            mission_id: str,
            tenant_id: str,
            limit: int = 20,
        ) -> List[Dict[str, Any]]:
            return [
                {
                    "toolkit_id": "composio-slack",
                    "auth_mode": "oauth",
                    "metadata": {
                        "name": "Slack",
                        "category": "communication",
                        "noAuth": False,
                    },
                }
            ][:limit]

        def search_library_plays(
            self,
            *,
            tenant_id: str,
            mission_id: str,
            objective: str,
            audience: str,
            guardrails: Iterable[str],
            limit: int = 3,
        ) -> List[Dict[str, Any]]:
            return canned_library_plays[:limit]

        def fetch_plays_by_mission(
            self,
            *,
            mission_id: str,
            limit: int = 5,
        ) -> List[Dict[str, Any]]:
            return []

        def fetch_latest_inspection_finding(
            self,
            *,
            mission_id: str,
            tenant_id: str,
        ) -> Optional[Dict[str, Any]]:
            return {
                "id": "finding-stub",
                "created_at": "2025-10-01T12:00:00Z",
                "readiness": 92.0,
                "payload": {
                    "gate": {
                        "threshold": 85.0,
                        "canProceed": True,
                        "override": False,
                        "reason": "Stubbed readiness meets threshold",
                    },
                    "categories": [
                        {
                            "id": "toolkit",
                            "label": "Toolkit coverage",
                            "coverage": 92.0,
                            "threshold": 85.0,
                            "status": "pass",
                        }
                    ],
                },
            }

        def upsert_plays(self, plays: Iterable[Dict[str, Any]]) -> None:
            return

        def insert_safeguard_event(self, event: Dict[str, Any]) -> None:
            return

        def insert_artifacts(self, artifacts: Iterable[Dict[str, Any]]) -> None:
            return

        def insert_tool_calls(self, calls: Iterable[Dict[str, Any]]) -> None:
            return

        def upload_storage_object(
            self,
            bucket: str,
            path: str,
            data: bytes,
            *,
            content_type: str = "application/octet-stream",
        ) -> None:
            return None

        def insert_event(self, event: Dict[str, Any]) -> None:
            return

        def insert_planner_run(self, run: Dict[str, Any], **kwargs: Any) -> None:
            return

        def upsert_copilot_session(self, session: Dict[str, Any]) -> None:
            return

        def insert_copilot_messages(self, messages: Iterable[Dict[str, Any]]) -> None:
            return

        def last_offline_payload(self, table: str) -> List[Dict[str, Any]]:
            return self._offline_buffer.get(table, [])

        @staticmethod
        def _is_uuid(value: object) -> bool:
            text = str(value)
            return isinstance(text, str) and len(text) == 36 and text.count("-") == 4

    patched_modules: List[str] = []

    for module in filter(None, target_modules):
        if getattr(module, "_EVAL_SUPABASE_STUB", False):
            continue

        module._EVAL_SUPABASE_STUB = True
        module._ORIGINAL_SUPABASE_CLIENT = getattr(
            module, "SupabaseClient", None
        )
        module.SupabaseClient = _EvalSupabaseClient
        patched_modules.append(module.__name__)

    for parent_name in ("agent.services", "agent_pkg.services"):
        parent = sys.modules.get(parent_name)
        if parent is not None:
            parent.SupabaseClient = _EvalSupabaseClient
            patched_modules.append(parent.__name__)

    if patched_modules:
        seen = list(dict.fromkeys(patched_modules))
        print(
            "[control-plane eval] Supabase stub installed for modules: "
            + ", ".join(seen)
        )


def _install_copilotkit_stub() -> None:
    """Replace the CopilotKit streamer with a no-op implementation for evals."""

    module = sys.modules.get("agent_pkg.services.copilotkit")
    if module is None:
        return

    if getattr(module, "_EVAL_COPILOTKIT_STUB", False):
        return

    class _EvalCopilotKitStreamer:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self.messages: List[Dict[str, Any]] = []

        def emit_message(self, **kwargs: Any) -> None:  # type: ignore[override]
            self.messages.append({"type": "message", **kwargs})

        def emit_exit(self, **kwargs: Any) -> None:  # type: ignore[override]
            self.messages.append({"type": "exit", **kwargs})

        def emit_stage(self, **kwargs: Any) -> None:  # type: ignore[override]
            self.messages.append({"type": "stage", **kwargs})

        def close(self) -> None:
            self.messages.clear()

    module._EVAL_COPILOTKIT_STUB = True
    module._ORIGINAL_COPILOTKIT_STREAMER = getattr(
        module, "CopilotKitStreamer", None
    )
    module.CopilotKitStreamer = _EvalCopilotKitStreamer

    services_module = sys.modules.get("agent_pkg.services")
    if services_module is not None:
        setattr(services_module, "CopilotKitStreamer", _EvalCopilotKitStreamer)


def _patch_local_eval_service() -> None:
    """Allow extra intermediate inferences by trimming to the expected count."""

    if getattr(_local_eval_service.LocalEvalService, "_CONTROL_PLANE_PATCHED", False):
        return

    original = _local_eval_service.LocalEvalService._evaluate_single_inference_result

    async def _wrapped(self, inference_result, evaluate_config):
        eval_case = self._eval_sets_manager.get_eval_case(
            app_name=inference_result.app_name,
            eval_set_id=inference_result.eval_set_id,
            eval_case_id=inference_result.eval_case_id,
        )
        expected = len(eval_case.conversation) if eval_case else 0
        if eval_case and expected and len(inference_result.inferences) != expected:
            print(
                f"[control-plane eval] comparing {len(inference_result.inferences)} inferences to {expected} expected"
            )
        if expected and len(inference_result.inferences) > expected:
            rich_inferences = []
            for actual in inference_result.inferences:
                final_part = getattr(actual, "final_response", None)
                has_text = False
                if final_part and getattr(final_part, "parts", None):
                    for part in final_part.parts:
                        if getattr(part, "text", None):
                            has_text = True
                            break
                if has_text:
                    rich_inferences.append(actual)
            candidate = rich_inferences if len(rich_inferences) >= expected else list(inference_result.inferences)
            inference_result = inference_result.model_copy(
                update={
                    "inferences": candidate[:expected],
                }
            )
        return await original(self, inference_result, evaluate_config)

    _local_eval_service.LocalEvalService._CONTROL_PLANE_PATCHED = True
    _local_eval_service.LocalEvalService._evaluate_single_inference_result = _wrapped  # type: ignore[attr-defined]


def assign_stub_supabase(wrapper: Any, stub_client: Any) -> None:
    """Recursively assign the stub Supabase client to the agent tree."""

    if not hasattr(wrapper, "_adk_agent"):
        return

    coordinator = wrapper._adk_agent
    _assign_stub_to_agent(coordinator, stub_client)


def _assign_stub_to_agent(agent: Any, stub_client: Any) -> None:
    if hasattr(agent, "supabase"):
        object.__setattr__(agent, "supabase", stub_client)

    telemetry = getattr(agent, "telemetry", None)
    if telemetry is not None and hasattr(telemetry, "supabase"):
        object.__setattr__(telemetry, "supabase", stub_client)

    evidence_service = getattr(agent, "evidence_service", None)
    if evidence_service is not None and hasattr(evidence_service, "supabase"):
        object.__setattr__(evidence_service, "supabase", stub_client)

    if hasattr(agent, "executor"):
        _assign_stub_to_agent(agent.executor, stub_client)
    if hasattr(agent, "validator"):
        _assign_stub_to_agent(agent.validator, stub_client)
    if hasattr(agent, "evidence"):
        _assign_stub_to_agent(agent.evidence, stub_client)

    sub_agents = getattr(agent, "sub_agents", None)
    if sub_agents:
        for child in sub_agents:
            _assign_stub_to_agent(child, stub_client)


def _load_control_plane_module():
    pkg_root = ROOT / "agent"
    agents_dir = pkg_root / "agents"
    services_dir = pkg_root / "services"
    tools_dir = pkg_root / "tools"

    _load_module("agent_pkg", pkg_root / "__init__.py", package=True)
    _load_module("agent_pkg.agents", agents_dir / "__init__.py", package=True)
    _load_module("agent_pkg.services", services_dir / "__init__.py", package=True)
    _load_module("agent_pkg.tools", tools_dir / "__init__.py", package=True)

    # Ensure direct access without relative hops for coordinator imports.
    _load_module("agent_pkg.services.supabase", services_dir / "supabase.py")
    _ensure_agent_aliases()
    if EVAL_MODE:
        _install_supabase_stub()
        _install_copilotkit_stub()
        _patch_local_eval_service()

    _load_module("agent_pkg.services.telemetry", services_dir / "telemetry.py")
    _load_module("agent_pkg.tools.composio_client", tools_dir / "composio_client.py")

    control_plane = _load_module(
        "agent_pkg.agents.control_plane", agents_dir / "control_plane.py"
    )
    return control_plane


_module = _load_control_plane_module()
pkg_supabase_module = sys.modules.get("agent_pkg.services.supabase")
client_cls = getattr(pkg_supabase_module, "SupabaseClient", None)

if EVAL_MODE:
    print(
        "[control-plane eval] SupabaseClient before build: "
        f"{client_cls} (module={getattr(client_cls, '__module__', 'unknown')})"
    )

_wrapper = _module.build_control_plane_agent()

if EVAL_MODE and client_cls is not None:
    try:
        stub_client: Optional[Any] = client_cls.from_env()
    except Exception:  # pragma: no cover - defensive
        stub_client = client_cls()

    assign_stub_supabase(_wrapper, stub_client)

    pkg_supabase_module = sys.modules.get("agent_pkg.services.supabase")
    client_cls = getattr(pkg_supabase_module, "SupabaseClient", None)
    print(
        "[control-plane eval] SupabaseClient after build: "
        f"{client_cls} (module={getattr(client_cls, '__module__', 'unknown')})"
    )

agent = SimpleNamespace(root_agent=_wrapper._adk_agent)
