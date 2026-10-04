import "./App.css";
import { useEffect, useState } from "react";

function App() {
  const [topics, setTopics] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  const loadTopics = () => {
    fetch("http://localhost:3001/topics")
      .then((res) => res.json())
      .then((data) => setTopics(data));
  };

  const loadPosts = (topicId: number) => {
    fetch(`http://localhost:3001/posts/topic/${topicId}`)
      .then((res) => res.json())
      .then((data) => setPosts(data));
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

      {posts.map((post) => (
        <div key={post.id}>
          {post.content}
        </div>
      ))}
    </div>
  );
}

export default App;