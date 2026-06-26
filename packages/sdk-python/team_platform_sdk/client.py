from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


class TeamPlatformError(RuntimeError):
    def __init__(self, message: str, status: int = 0, code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


@dataclass
class TeamPlatformClient:
    base_url: str
    token: str | None = None
    timeout: float = 5.0

    def login(self, email: str, name: str) -> dict[str, Any]:
        result = self._request("POST", "/auth/login", {"email": email, "name": name})
        token = result.get("token")
        if isinstance(token, str):
            self.token = token
        return result

    def list_projects(self, page: int = 1, page_size: int = 20) -> dict[str, Any]:
        return self._request("GET", f"/projects?page={page}&pageSize={page_size}")

    def validate_manifest(self, manifest: str) -> dict[str, Any]:
        return self._request("POST", "/project-manifests/validate", {"manifest": manifest})

    def apply_manifest(self, manifest: str) -> dict[str, Any]:
        return self._request("POST", "/project-manifests/apply", {"manifest": manifest})

    def governance_dashboard(self, project_slug: str) -> dict[str, Any]:
        return self._request("GET", f"/projects/{project_slug}/governance-dashboard")

    def create_governance_record(
        self,
        project_slug: str,
        kind: str,
        name: str,
        status: str,
        data: dict[str, Any] | None = None,
        service_id: str | None = None,
        environment_slug: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"kind": kind, "name": name, "status": status, "data": data or {}}
        if service_id:
            body["serviceId"] = service_id
        if environment_slug:
            body["environmentSlug"] = environment_slug
        return self._request("POST", f"/projects/{project_slug}/governance-records", body)

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"accept": "application/json"}
        if body is not None:
            headers["content-type"] = "application/json"
        if self.token:
            headers["authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(
            f"{self.base_url.rstrip('/')}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            payload = exc.read().decode("utf-8")
            try:
                error = json.loads(payload).get("error", {})
            except json.JSONDecodeError:
                error = {}
            raise TeamPlatformError(
                error.get("message", "request failed"),
                exc.code,
                error.get("code"),
            ) from exc
        except urllib.error.URLError as exc:
            raise TeamPlatformError(str(exc.reason)) from exc
