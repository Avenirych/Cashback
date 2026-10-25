import React, { useEffect, useRef, useState } from "react";
import { translations } from "../i18n";
import Footer from "../components/Footer";
import content from "../content/publicPages.json";
import "./Contacts.css";
import "./ForumRules.css";

type ContactNode = string | { tag: string; props: Record<string, string>; children: ContactNode[] };
function renderNode(node: ContactNode, key: number): React.ReactNode {
  if (typeof node === "string") return node;
  const children = node.children.flatMap((child, index) =>
    index && node.tag === "p" ? [" ", renderNode(child, index)] : [renderNode(child, index)]);
  return React.createElement(node.tag, { ...node.props, key }, ...children);
}
function ContactPanel({ title, blocks, id, closeSignal }: { title: string; blocks: ContactNode[]; id: string; closeSignal: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [closeSignal]);
  const toggle = () => setOpen(previous => !previous);
  return <details className="forum-rule-panel" open={open}>
    <summary id={id + "-heading"} role="button" tabIndex={0}
      aria-expanded={open} aria-controls={id}
      onClick={event => { event.preventDefault(); toggle(); }}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
      }}>
      <span>{title}</span><span className="forum-rule-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div className="forum-rule-body" id={id} aria-labelledby={id + "-heading"}>
      {blocks.map(renderNode)}
    </div>
  </details>;
}
export default function Contacts({ lang }: { lang: string }) {
  const code = (lang || "en").toLowerCase();
  const language = Object.prototype.hasOwnProperty.call(content.contacts, code) ? code as keyof typeof content.contacts : "en";
  const page = content.contacts[language];
  const group = useRef<HTMLDivElement>(null);
  const [closeSignal, setCloseSignal] = useState(0);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !group.current?.contains(event.target)) setCloseSignal(value => value + 1);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (group.current?.contains(document.activeElement)) {
        event.preventDefault();
        document.activeElement?.closest("details")?.querySelector("summary")?.focus();
      }
      setCloseSignal(value => value + 1);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside, true); document.removeEventListener("keydown", escape); };
  }, []);
  return <>
    <main className="forum-rules-page" lang={language}>
      <h1>{page.title}</h1>
      {page.intro.map(renderNode)}
      <div className="forum-rule-sections" key={language} ref={group}>
        {page.sections.map((section, index) => <ContactPanel key={index} title={section.title}
          blocks={section.blocks} closeSignal={closeSignal} id={`contact-${language}-${index}`} />)}
      </div>
      <p style={{marginTop: "26px", textAlign: "center", color: "#666", fontSize: "14px"}}>
        {translations[language.toUpperCase() as keyof typeof translations].closeOnClickOutside}
      </p>
    </main>
    <Footer lang={language.toUpperCase()} />
  </>;
}
