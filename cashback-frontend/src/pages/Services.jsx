import React from "react";
import content from "../content/publicPages.json";
import "./Services.css";

export default function Services({ lang }) {
  const language = (lang || "en").toLowerCase();
  const L = content.services[language] || content.services.en;
  return (
    <div className="services-container" lang={language}>
      <h1>{L.title}</h1>
          {L.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) =>
                block.type === "list" ? (
                  <ul key={index}>
                    {block.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p key={index}>{block.text}</p>
                )
              )}
            </section>
          ))}
    </div>
  );
}
