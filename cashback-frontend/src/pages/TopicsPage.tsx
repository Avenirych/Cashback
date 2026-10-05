import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [title, setTitle] = useState("");

  const loadTopics = async () => {
    try {
      const response = await fetch(
        "http://localhost:3001/topics"
      );

      const data = await response.json();

      console.log("TOPICS:", data);

      setTopics(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
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
      body: JSON.stringify({
        title,
      }),
    });

    setTitle("");
    await loadTopics();
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
        Create Topic
      </button>

      <hr />

      {topics.map((topic) => (
        <div key={topic.id}>
          <Link to={`/topic/${topic.id}`}>
            {topic.title}
          </Link>
        </div>
      ))}
    </div>
  );
}