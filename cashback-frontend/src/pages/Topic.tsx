import { useEffect, useState } from "react";

export default function Topic() {
  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const loadPosts = async () => {
    const response = await fetch(
      "http://localhost:3001/posts/topic/1"
    );

    const data = await response.json();

    setPosts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await fetch("http://localhost:3001/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicId: 1,
        content: message,
      }),
    });

    setMessage("");
    await loadPosts();
  };

  return (
    <div>
      <h1>postgres test</h1>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message"
      />

      <button onClick={sendMessage}>
        Send
      </button>

      <hr />

      {posts.map((post) => (
        <div key={post.id}>
          {post.content}
        </div>
      ))}
    </div>
  );
}