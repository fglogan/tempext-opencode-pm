mod api;
mod events;
mod ko;
mod models;

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
    tracing::info!("OpenCode PM up at http://{addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

use axum::{extract::State, Json};
async fn vos_dispatch(
    State(reg): State<Arc<ServiceRegistry>>,
    Json(msg): Json<VosMessage>,
) -> Json<VosMessage> {
    let resp = reg.dispatch(msg).await.unwrap_or_else(|e| VosMessage {
        target: "error".into(),
        op: "error".into(),
        payload: serde_json::json!({"err": e.to_string()}),
    });
    Json(resp)
}
