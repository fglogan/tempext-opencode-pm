use crate::laio_service::{LaioService, VosError, VosMessage};
use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;

/// Minimal ContextService that returns related KO refs for a file/task.
/// (OpenCode plugin will call via vos_dispatch.)
pub struct ContextService;

#[async_trait]
impl LaioService for ContextService {
    fn service_name(&self) -> &'static str {
        "context_service"
    }

    fn capabilities(&self) -> Vec<String> {
        vec!["context.fetch".into()]
    }

    async fn handle_message(&self, message: VosMessage) -> Result<VosMessage, VosError> {
        let path = message
            .payload
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(".");
        let result = json!({
            "path": path,
            "ko_refs": [
                {"id":"ko://docs/adr/0001-service-registry"},
                {"id":"ko://schemas/opencode_pm.openapi.json"}
            ]
        });
        Ok(VosMessage {
            target: "context_service".into(),
            op: "context.fetch.ok".into(),
            payload: result,
        })
    }
}

pub fn default_registry() -> Arc<crate::laio_service::ServiceRegistry> {
    let reg = Arc::new(crate::laio_service::ServiceRegistry::new());
    reg.register(Arc::new(ContextService));
    reg
}
