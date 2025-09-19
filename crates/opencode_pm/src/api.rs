use axum::{extract::State, http::StatusCode, Json};
use opencode_pm_core::laio_service::ServiceRegistry;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Serialize)]
pub struct Health {
    status: &'static str,
}

pub async fn health() -> (StatusCode, Json<Health>) {
    (StatusCode::OK, Json(Health { status: "ok" }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidateReq {
    pub schema: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SidecarValidateResp {
    pub ok: bool,
    #[serde(default)]
    pub errors: Option<serde_json::Value>,
}

#[derive(Clone)]
pub struct AppState {
    pub reg: Arc<ServiceRegistry>,
    pub http: reqwest::Client,
    pub sidecar_base: String,
}

pub async fn validate_proxy(
    State(st): State<Arc<AppState>>,
    Json(req): Json<ValidateReq>,
) -> (StatusCode, Json<serde_json::Value>) {
    let url = format!("{}/validate", st.sidecar_base);
    let resp = st
        .http
        .post(url)
        .json(&req)
        .send()
        .await;

    match resp {
        Ok(r) => {
            let status = r.status();
            match r.json::<SidecarValidateResp>().await {
                Ok(body) => {
                    let code = if body.ok {
                        StatusCode::OK
                    } else {
                        StatusCode::UNPROCESSABLE_ENTITY
                    };
                    (code, Json(serde_json::to_value(body).unwrap()))
                }
                Err(e) => (
                    StatusCode::BAD_GATEWAY,
                    Json(serde_json::json!({
                        "ok": false,
                        "error": "invalid_sidecar_response",
                        "msg": e.to_string(),
                        "status": status.as_u16()
                    })),
                ),
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({
                "ok": false,
                "error": "sidecar_unreachable",
                "msg": e.to_string()
            })),
        ),
    }
}
