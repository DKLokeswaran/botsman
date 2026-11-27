// Generated from packages/protocol/schema/alerts.schema.json by `pnpm --filter @botsman/protocol alerts-schema`. Do not edit.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};

// Unknown stands for a value added after this build.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertKind {
    #[serde(rename = "approval")]
    Approval,
    #[serde(rename = "question")]
    Question,
    #[serde(rename = "routine_result")]
    RoutineResult,
    #[serde(rename = "failure")]
    Failure,
    #[serde(rename = "channel_mention")]
    ChannelMention,
    #[serde(rename = "routine_created")]
    RoutineCreated,
    #[serde(rename = "skill_created")]
    SkillCreated,
    #[serde(other)]
    Unknown,
}

impl AlertKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Approval => "approval",
            Self::Question => "question",
            Self::RoutineResult => "routine_result",
            Self::Failure => "failure",
            Self::ChannelMention => "channel_mention",
            Self::RoutineCreated => "routine_created",
            Self::SkillCreated => "skill_created",
            Self::Unknown => "",
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Alert {
    pub id: String,
    pub kind: AlertKind,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

// Unknown stands for a message type added after this build.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum AlertsClientMessage {
    #[serde(rename = "hello")]
    Hello {
        token: String,
        epoch: String,
        seq: i64,
    },
    #[serde(rename = "ping")]
    Ping,
    #[serde(other)]
    Unknown,
}

// Unknown stands for a message type added after this build.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum AlertsServerMessage {
    #[serde(rename = "alert")]
    Alert {
        epoch: String,
        seq: i64,
        alert: Alert,
    },
    #[serde(rename = "reset")]
    Reset {
        epoch: String,
        seq: i64,
    },
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "pong")]
    Pong,
    #[serde(rename = "error")]
    Error {
        error: String,
        message: String,
    },
    #[serde(other)]
    Unknown,
}
