import "./App.css";
import { useEffect, useState } from "react";

function App() {
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState<any[]>([]);

  const loadTopics = () => {
    fetch("http://localhost:3001/topics")
      .then((res) => res.json())
      .then((data) => setTopics(data));
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const createTopic = async () => {
    if (!title.trim()) return;

    await fetch("http://localhost:3001/topics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    setTitle("");
    loadTopics();
  };

  return (
    <div>
      <h1>Cashback+ Forum</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Topic title"
      />

      <button onClick={createTopic}>
        New Topic
      </button>

      {topics.map((topic) => (
        <div key={topic.id}>
          {topic.title}
        </div>
      ))}
    </div>
  );
}

export default App;