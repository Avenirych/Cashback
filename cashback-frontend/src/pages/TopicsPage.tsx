import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [title, setTitle] = useState("");

  const navigate = useNavigate();

  const loadTopics = async () => {
    const response = await fetch(
      "http://localhost:3001/topics"
    );

    const data = await response.json();

    setTopics(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const createTopic = async () => {
    if (!title.trim()) return;

    const response = await fetch(
      "http://localhost:3001/topics",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
        }),
      }
    );

    const topic = await response.json();

    setTitle("");

    navigate(`/topic/${topic.id}`);
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "30px auto",
      }}
    >
      <h1>Cashback+ Forum</h1>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Topic title"
          style={{
            flex: 1,
            padding: "10px",
          }}
        />

        <button onClick={createTopic}>
          Create Topic
        </button>
      </div>

      <hr />

      {topics.map((topic) => (
        <div
          key={topic.id}
          style={{
            padding: "10px 0",
            borderBottom: "1px solid #eee",
          }}
        >
          <Link to={`/topic/${topic.id}`}>
            {topic.title}
          </Link>

          {" "}

          <strong>
            ({topic.posts?.length ?? 0})
          </strong>
        </div>
      ))}
    </div>
  );
}