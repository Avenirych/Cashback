import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  const loadTopics = async () => {
    const response = await fetch(
      "http://localhost:3001/topics"
    );

    const data = await response.json();

    const sortedTopics = [...data].sort((a, b) => {
      const aLastPost =
        a.posts?.length > 0
          ? a.posts[a.posts.length - 1]
          : null;

      const bLastPost =
        b.posts?.length > 0
          ? b.posts[b.posts.length - 1]
          : null;

      const aTime = aLastPost
        ? new Date(
            aLastPost.createdAt ?? 0
          ).getTime()
        : new Date(
            a.createdAt ?? 0
          ).getTime();

      const bTime = bLastPost
        ? new Date(
            bLastPost.createdAt ?? 0
          ).getTime()
        : new Date(
            b.createdAt ?? 0
          ).getTime();

      return bTime - aTime;
    });

    setTopics(sortedTopics);
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
 
const deleteTopic = async (id: number) => {
const confirmed = window.confirm(
"Delete this topic?"
);
 
if (!confirmed) return;
 
await fetch(
`http://localhost:3001/topics/${id}`,
{
method: "DELETE",
}
);
 
await loadTopics();
};
 
const filteredTopics = useMemo(() => {
return topics.filter((topic) =>
topic.title
?.toLowerCase()
.includes(search.toLowerCase())
);
}, [topics, search]);

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
          marginBottom: "15px",
        }}
      >
        <input
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
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

      <input
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        placeholder="Search topics..."
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "20px",
        }}
      />

      {filteredTopics.map((topic) => {
        const lastPost =
          topic.posts?.length > 0
            ? topic.posts[
                topic.posts.length - 1
              ]
            : null;

        return (
          <div
            key={topic.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "15px",
              marginBottom: "12px",
              background: "#fafafa",
              transition:
                "box-shadow 0.2s ease",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              <div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
}}
>
<div>
<Link to={`/topic/${topic.id}`}>
{topic.title}
</Link>{" "}
<strong>
({topic.posts?.length ?? 0})
</strong>
</div>
 
<button
onClick={() =>
deleteTopic(topic.id)
}
>
Delete
</button>
</div>

              <strong>
                ({topic.posts?.length ?? 0})
              </strong>
            </div>

            {topic.createdAt && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                Created:{" "}
                {new Date(
                  topic.createdAt
                ).toLocaleString()}
              </div>
            )}

            {lastPost && (
              <div
                style={{
                  marginTop: "12px",
                }}
              >
                <strong>
                  Last message:
                </strong>

                <div
                  style={{
                    marginTop: "4px",
                  }}
                >
                  {lastPost.content}
                </div>

                {lastPost.createdAt && (
                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    {new Date(
                      lastPost.createdAt
                    ).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}