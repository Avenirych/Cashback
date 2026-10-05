import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function Topic() {
  const { id } = useParams();

  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const loadPosts = async () => {
    if (!id) return;

    const response = await fetch(
      `http://localhost:3001/posts/topic/${id}`
    );

    const data = await response.json();

    setPosts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadPosts();
  }, [id]);

  const sendMessage = async () => {
    if (!id) return;
    if (!message.trim()) return;

    await fetch("http://localhost:3001/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicId: Number(id),
        content: message,
      }),
    });

    setMessage("");
    await loadPosts();
  };

  const deletePost = async (postId: number) => {
    await fetch(
      `http://localhost:3001/posts/${postId}`,
      {
        method: "DELETE",
      }
    );

    await loadPosts();
  };

  const topic =
    posts.length > 0
      ? posts[0].topic
      : null;

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto" }}>
      <Link to="/">
        ← Back to Topics
      </Link>

      <h1 style={{ marginTop: "20px" }}>
        {topic?.title ?? `Topic #${id}`}
      </h1>

      {topic?.createdAt && (
        <div
          style={{
            color: "#666",
            marginBottom: "10px",
          }}
        >
          Created:{" "}
          {new Date(
            topic.createdAt
          ).toLocaleString()}
        </div>
      )}

      <div
        style={{
          marginBottom: "20px",
          fontWeight: 600,
        }}
      >
        Messages: {posts.length}
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <input
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          placeholder="Write a message..."
          style={{
            flex: 1,
            padding: "10px",
          }}
        />

        <button onClick={sendMessage}>
          Send
        </button>
      </div>

      {posts.length === 0 && (
        <div
          style={{
            padding: "20px",
            border: "1px dashed #ccc",
            borderRadius: "10px",
            color: "#666",
          }}
        >
          No messages yet.
          <br />
          Be the first to reply.
        </div>
      )}

      {posts.map((post) => (
        <div
          key={post.id}
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            marginBottom: "12px",
            borderRadius: "10px",
            backgroundColor: "#fafafa",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <strong>
              Message #{post.id}
            </strong>

            <button
              onClick={() =>
                deletePost(post.id)
              }
            >
              Delete
            </button>
          </div>

          <div
            style={{
              marginTop: "8px",
              marginBottom: "8px",
            }}
          >
            {post.content}
          </div>

          {post.createdAt && (
            <div
              style={{
                fontSize: "12px",
                color: "#666",
              }}
            >
              {new Date(
                post.createdAt
              ).toLocaleString()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}