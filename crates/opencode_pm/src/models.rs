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

#[cfg(test)]
mod tests {
    use super::*;
    use time::macros::datetime;

    #[test]
    fn test_project_serialization() {
        let project = Project {
            id: Uuid::new_v4(),
            name: "Test Project".to_string(),
            created_at: datetime!(2025-09-18 12:00:00 UTC),
        };
        let json = serde_json::to_string(&project).unwrap();
        let deserialized: Project = serde_json::from_str(&json).unwrap();
        assert_eq!(project.id, deserialized.id);
        assert_eq!(project.name, deserialized.name);
    }

    #[test]
    fn test_queue_serialization() {
        let queue = Queue {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            name: "test_queue".to_string(),
        };
        let json = serde_json::to_string(&queue).unwrap();
        let deserialized: Queue = serde_json::from_str(&json).unwrap();
        assert_eq!(queue.id, deserialized.id);
        assert_eq!(queue.project_id, deserialized.project_id);
        assert_eq!(queue.name, deserialized.name);
    }

    #[test]
    fn test_task_serialization() {
        let task = Task {
            id: Uuid::new_v4(),
            queue_id: Uuid::new_v4(),
            kind: "analysis".to_string(),
            ko_refs: vec!["ko://test/1".to_string()],
            created_at: datetime!(2025-09-18 12:00:00 UTC),
        };
        let json = serde_json::to_string(&task).unwrap();
        let deserialized: Task = serde_json::from_str(&json).unwrap();
        assert_eq!(task.id, deserialized.id);
        assert_eq!(task.queue_id, deserialized.queue_id);
        assert_eq!(task.kind, deserialized.kind);
        assert_eq!(task.ko_refs, deserialized.ko_refs);
    }

    #[test]
    fn test_attempt_serialization() {
        let attempt = Attempt {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            n: 1,
            started_at: datetime!(2025-09-18 12:00:00 UTC),
            finished_at: Some(datetime!(2025-09-18 12:05:00 UTC)),
            runlog_ko: Some("ko://runlog/1".to_string()),
            confidence: Some(0.85),
        };
        let json = serde_json::to_string(&attempt).unwrap();
        let deserialized: Attempt = serde_json::from_str(&json).unwrap();
        assert_eq!(attempt.id, deserialized.id);
        assert_eq!(attempt.task_id, deserialized.task_id);
        assert_eq!(attempt.n, deserialized.n);
        assert_eq!(attempt.finished_at, deserialized.finished_at);
        assert_eq!(attempt.runlog_ko, deserialized.runlog_ko);
        assert_eq!(attempt.confidence, deserialized.confidence);
    }

    #[test]
    fn test_attempt_pending() {
        let attempt = Attempt {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            n: 1,
            started_at: datetime!(2025-09-18 12:00:00 UTC),
            finished_at: None,
            runlog_ko: None,
            confidence: None,
        };
        assert!(attempt.finished_at.is_none());
        assert!(attempt.runlog_ko.is_none());
        assert!(attempt.confidence.is_none());
    }
}
