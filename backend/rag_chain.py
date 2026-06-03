import os
import json
from typing import AsyncGenerator, List, TypedDict
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from ingestor import get_vectorstore


# ── LangGraph state schema ────────────────────────────────────────────────────

class ChatState(TypedDict):
    question:     str
    chat_history: List
    context_docs: List
    answer:       str


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_retriever(k: int = 6):
    vs = get_vectorstore()
    return vs.as_retriever(search_kwargs={"k": k})


def format_context(docs) -> str:
    parts = []
    for doc in docs:
        m = doc.metadata
        parts.append(
            f"[{m['source']}]\n"
            f"Platform: {m['platform']} | Creator: @{m['creator']} | "
            f"Views: {m['views']:,} | Likes: {m['likes']:,} | "
            f"Comments: {m['comments']:,} | Followers: {m['follower_count']:,} | "
            f"Engagement: {m['engagement_rate']}% | Duration: {m['duration']}s | "
            f"Uploaded: {m['upload_date']} | Hashtags: {m['hashtags']}\n\n"
            f"{doc.page_content}"
        )
    return "\n\n─────\n\n".join(parts)


SYSTEM_PROMPT = """You are a sharp social media analytics assistant helping a content creator understand why their videos perform the way they do.

You have access to retrieved chunks from two videos:
- Video A = YouTube
- Video B = Instagram Reel

Each chunk includes metadata: engagement rate, views, likes, comments, follower count, creator name, hashtags, upload date, and duration.

Rules:
1. Cite every claim with the source chunk: [Video A — chunk 3]
2. Use exact numbers from metadata when discussing metrics — never round unless for readability
3. When comparing hooks, quote the actual transcript text
4. When suggesting improvements, ground every suggestion in what actually worked (from the data)
5. Be direct and analytical — you're talking to a creator, not a journalist
6. If engagement rate is high despite low views, call that out — it's signal

Engagement rate formula: (likes + comments) / views x 100

Retrieved context:
{context}
"""


# ── LangGraph nodes ───────────────────────────────────────────────────────────

def retrieve_node(state: ChatState) -> ChatState:
    retriever = get_retriever()
    docs = retriever.invoke(state["question"])
    return {**state, "context_docs": docs}


def answer_node(state: ChatState) -> ChatState:
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        groq_api_key=os.getenv("GROQ_API_KEY"),
    )

    context = format_context(state["context_docs"])

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ])

    chain = prompt | llm | StrOutputParser()
    answer = chain.invoke({
        "context":      context,
        "chat_history": state["chat_history"],
        "question":     state["question"],
    })

    return {**state, "answer": answer}


# ── Compiled graph ────────────────────────────────────────────────────────────

def build_rag_graph():
    g = StateGraph(ChatState)
    g.add_node("retrieve", retrieve_node)
    g.add_node("answer",   answer_node)
    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "answer")
    g.add_edge("answer", END)
    return g.compile()


# ── Streaming entry point (used by FastAPI) ───────────────────────────────────

async def stream_answer(question: str, chat_history: list) -> AsyncGenerator[str, None]:
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        groq_api_key=os.getenv("GROQ_API_KEY"),
    )

    retriever = get_retriever()
    docs = retriever.invoke(question)
    context = format_context(docs)

    sources = list({doc.metadata["source"] for doc in docs})
    sources_payload = json.dumps({"type": "sources", "sources": sources})
    yield f"data: {sources_payload}\n\n"

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ])

    chain = prompt | llm

    full_response = ""
    async for chunk in chain.astream({
        "context":      context,
        "chat_history": chat_history,
        "question":     question,
    }):
        if chunk.content:
            full_response += chunk.content
            token_payload = json.dumps({"type": "token", "content": chunk.content})
            yield f"data: {token_payload}\n\n"

    done_payload = json.dumps({"type": "done", "full": full_response})
    yield f"data: {done_payload}\n\n"


def history_to_langchain(raw: list) -> list:
    """Convert [{role, content}] to LangChain message objects."""
    messages = []
    for m in raw:
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            messages.append(AIMessage(content=m["content"]))
    return messages
