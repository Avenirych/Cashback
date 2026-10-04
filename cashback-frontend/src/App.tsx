import "./App.css";
import { useEffect, useState } from "react";

function App() {
  const [topics, setTopics] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const loadTopics = async () => {
    const response = await fetch(
      "http://localhost:3001/topics"
    );

    const data = await response.json();

    setTopics(data);
  };

  const loadPosts = async (topicId: number) => {
    setSelectedTopicId(topicId);

    const response = await fetch(
      `http://localhost:3001/posts/topic/${topicId}`
    );

    const data = await response.json();

    setPosts(data);
  };

  const sendMessage = async () => {
    if (!selectedTopicId) return;

    if (!message.trim()) return;

    const response = await fetch(
      "http://localhost:3001/posts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicId: selectedTopicId,
          content: message,
        }),
      }
    );

    const result = await response.json();

    console.log(result);

    setMessage("");

    await loadPosts(selectedTopicId);
  };

  useEffect(() => {
    loadTopics();
  }, []);

  return (
    <div>
      <h1>Cashback+ Forum</h1>

      {topics.map((topic) => (
        <div
          key={topic.id}
          onClick={() => loadPosts(topic.id)}
          style={{
            cursor: "pointer",
            color: "blue",
            marginBottom: "10px",
          }}
        >
          {topic.title}
        </div>
      ))}

      <hr />

      <div>
        Topic: {selectedTopicId ?? "not selected"}
      </div>

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

export default App;