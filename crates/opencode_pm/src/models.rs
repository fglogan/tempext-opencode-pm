use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Queue {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: Uuid,
    pub queue_id: Uuid,
    pub kind: String,
    pub ko_refs: Vec<String>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attempt {
    pub id: Uuid,
    pub task_id: Uuid,
    pub n: i32,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
    pub runlog_ko: Option<String>,
    pub confidence: Option<f32>,
}
