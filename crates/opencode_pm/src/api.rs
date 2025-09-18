use axum::{http::StatusCode, Json};
use serde::Serialize;

#[derive(Serialize)]
pub struct Health {
    status: &'static str,
}

pub async fn health() -> (StatusCode, Json<Health>) {
    (StatusCode::OK, Json(Health { status: "ok" }))
}
