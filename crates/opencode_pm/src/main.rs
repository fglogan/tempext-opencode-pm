mod api;
mod events;
mod ko;
mod models;
mod services;

use axum::{
    routing::{get, post},
    Router,
};
use opencode_pm_core::{
    context_service,
    laio_service::{ServiceRegistry, VosMessage},
};
use std::{net::SocketAddr, sync::Arc};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    // minimal service registry (Core↔Core)
    let registry: Arc<ServiceRegistry> = context_service::default_registry();
    let app = Router::new()
        .route("/v1/health", get(api::health))
        .route("/v1/vos_dispatch", post(vos_dispatch))
        .with_state(registry);

    let port = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            // Requested port busy; fall back to ephemeral port
            tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], 0)))
                .await
                .expect("failed to bind to an ephemeral port")
        }
        Err(e) => panic!("failed to bind server socket: {e}"),
    };
    let bound = listener
        .local_addr()
        .unwrap_or(SocketAddr::from(([127, 0, 0, 1], port)));
    tracing::info!("OpenCode PM up at http://{bound}");
    axum::serve(listener, app).await.unwrap();
}

use crate::services::model_manager::{ChatBatchReq, ModelManagerService};
use crate::services::specbundle::{SpecbundleCreateReq, SpecbundleService};
use axum::{extract::State, Json};

async fn vos_dispatch(
    State(reg): State<Arc<ServiceRegistry>>,
    Json(msg): Json<VosMessage>,
) -> Json<VosMessage> {
    // Handle specbundle.create directly
    if msg.target == "opencode_pm" && msg.op == "specbundle.create" {
        match serde_json::from_value::<SpecbundleCreateReq>(msg.payload.clone()) {
            Ok(req) => match SpecbundleService::create(req).await {
                Ok(resp) => {
                    let payload = serde_json::to_value(resp)
                        .unwrap_or(serde_json::json!({"error": "serialize"}));
                    return Json(VosMessage {
                        target: "opencode_pm".into(),
                        op: "specbundle.created".into(),
                        payload,
                    });
                }
                Err(e) => {
                    return Json(VosMessage {
                        target: "error".into(),
                        op: "error".into(),
                        payload: serde_json::json!({"err": e.to_string()}),
                    });
                }
            },
            Err(e) => {
                return Json(VosMessage {
                    target: "error".into(),
                    op: "error".into(),
                    payload: serde_json::json!({"err": "invalid request", "details": e.to_string()}),
                });
            }
        }
    }

    // Handle model_manager.chat.batch directly
    if msg.target == "model_manager" && msg.op == "chat.batch" {
        match serde_json::from_value::<ChatBatchReq>(msg.payload.clone()) {
            Ok(req) => match ModelManagerService::chat_batch(req).await {
                Ok(resp) => {
                    let payload = serde_json::to_value(resp)
                        .unwrap_or(serde_json::json!({"error": "serialize"}));
                    return Json(VosMessage {
                        target: "model_manager".into(),
                        op: "chat.batch.ok".into(),
                        payload,
                    });
                }
                Err(e) => {
                    return Json(VosMessage {
                        target: "error".into(),
                        op: "error".into(),
                        payload: serde_json::json!({"err": e.to_string()}),
                    });
                }
            },
            Err(e) => {
                return Json(VosMessage {
                    target: "error".into(),
                    op: "error".into(),
                    payload: serde_json::json!({"err": "invalid request", "details": e.to_string()}),
                });
            }
        }
    }

    // Handle secrets.set directly
    if msg.target == "opencode_pm" && msg.op == "secrets.set" {
        use crate::services::secrets::{SecretSetReq, SecretsService};
        match serde_json::from_value::<SecretSetReq>(msg.payload.clone()) {
            Ok(req) => match SecretsService::set(req).await {
                Ok(_) => {
                    return Json(VosMessage {
                        target: "opencode_pm".into(),
                        op: "secrets.ok".into(),
                        payload: serde_json::json!({}),
                    })
                }
                Err(e) => {
                    return Json(VosMessage {
                        target: "error".into(),
                        op: "error".into(),
                        payload: serde_json::json!({"err":"secrets_set_failed","msg":e.to_string()}),
                    })
                }
            },
            Err(e) => {
                return Json(VosMessage {
                    target: "error".into(),
                    op: "error".into(),
                    payload: serde_json::json!({"err":"bad_request","msg":e.to_string()}),
                })
            }
        }
    }

    // Handle secrets.get directly
    if msg.target == "opencode_pm" && msg.op == "secrets.get" {
        use crate::services::secrets::{SecretGetReq, SecretsService};
        match serde_json::from_value::<SecretGetReq>(msg.payload.clone()) {
            Ok(req) => match SecretsService::get(req).await {
                Ok(resp) => {
                    return Json(VosMessage {
                        target: "opencode_pm".into(),
                        op: "secrets.value".into(),
                        payload: serde_json::to_value(resp).unwrap(),
                    })
                }
                Err(e) => {
                    return Json(VosMessage {
                        target: "error".into(),
                        op: "error".into(),
                        payload: serde_json::json!({"err":"secrets_get_failed","msg":e.to_string()}),
                    })
                }
            },
            Err(e) => {
                return Json(VosMessage {
                    target: "error".into(),
                    op: "error".into(),
                    payload: serde_json::json!({"err":"bad_request","msg":e.to_string()}),
                })
            }
        }
    }

    let resp = reg.dispatch(msg).await.unwrap_or_else(|e| VosMessage {
        target: "error".into(),
        op: "error".into(),
        payload: serde_json::json!({ "err": e.to_string() }),
    });

    Json(resp)
}
