from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class QueryRequest(BaseModel):
    question: str
    team_id: str = Field(alias="teamId")
    conversation_id: str | None = Field(default=None, alias="conversationId")


class EmbedRequest(BaseModel):
    text: str | None = None
    texts: list[str] | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "EmbedRequest":
        if not self.text and not self.texts:
            raise ValueError("Provide either 'text' or 'texts'.")
        return self


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
