use crate::laio_service::{LaioService, VosError, VosMessage};
use async_trait::async_trait;
use serde_json::json;
use uuid::Uuid;

/// PM Service for handling OpenCode PM operations
pub struct PmService;

#[async_trait]
impl LaioService for PmService {
    fn service_name(&self) -> &'static str {
        "opencode_pm"
    }

    fn capabilities(&self) -> Vec<String> {
        vec!["specbundle.create".into()]
    }

    async fn handle_message(&self, message: VosMessage) -> Result<VosMessage, VosError> {
        match message.op.as_str() {
            "specbundle.create" => {
                // Stub: generate a KO ref for the SpecBundle
                let ko_ref = format!("ko://specbundle/{}", Uuid::new_v4());
                Ok(VosMessage {
                    target: "opencode_pm".into(),
                    op: "specbundle.created".into(),
                    payload: json!({
                        "ko_ref": ko_ref,
                        "status": "created"
                    }),
                })
            }
            _ => Err(VosError::BadRequest("Unsupported operation".to_string())),
        }
    }
}