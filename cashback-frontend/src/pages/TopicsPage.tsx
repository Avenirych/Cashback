import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function TopicPage() {
  const { id } = useParams();

  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const loadPosts = async () => {
    const response = await fetch(
      `http://localhost:3001/posts/topic/${id}`
    );

    const data = await response.json();

    setPosts(data);
  };

  useEffect(() => {
    loadPosts();
  }, [id]);

  const sendMessage = async () => {
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

  return (
    <div>
      <h1>Topic #{id}</h1>

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

export default TopicPage;