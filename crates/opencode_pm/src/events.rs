use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueTaskCreated {
    pub project_id: String,
    pub task_id: String,
    pub kind: String,
    pub ko_refs: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub task_id: String,
    pub decisions: Vec<String>,
    pub sse_verdict_ko: Option<String>,
}
