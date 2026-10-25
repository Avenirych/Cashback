import React from "react";
import content from "../content/publicPages.json";
import "./AboutUs.css";

export default function AboutUs({ lang }) {
  const language = (lang || "en").toLowerCase();
  const L = content.about[language] || content.about.en;
  return (
    <div className="about-container" lang={language}>
      <h1>{L.title}</h1>
          {L.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) =>
                block.type === "heading" ? (
                  <h3 key={index}>{block.text}</h3>
                ) : block.type === "list" ? (
                  <ul key={index}>
                    {block.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p key={index}>{block.text}</p>
                )
              )}
            </section>
          ))}
      <section><h2>{L.join}</h2><p>{L.joinText}</p></section>
    </div>
  );
}
