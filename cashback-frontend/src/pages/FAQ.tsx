import React, { useEffect, useRef, useState } from "react";
import Footer from "../components/Footer";
import { translations } from "../i18n";

interface FAQProps {
  lang: string;
}

export default function FAQ({ lang }: FAQProps) {
  const normalizedLang = (lang || "EN").toUpperCase();
  const languageKey = normalizedLang as keyof typeof translations;

  const t = translations[languageKey] ?? translations.EN;

  const hasTranslatedItems = t.faqItems.length > 0;
  const faqItems = hasTranslatedItems
    ? t.faqItems
    : translations.EN.faqItems;

  const answersLanguage = hasTranslatedItems
    ? languageKey.toLowerCase()
    : "en";

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const questionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setOpenIndex(null);
  }, [normalizedLang]);

  useEffect(() => {
    if (openIndex === null) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      const activeCard = activeCardRef.current;

      if (activeCard && !activeCard.contains(event.target)) {
        setOpenIndex(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      const activeCard = activeCardRef.current;
      const focusWasInside =
        activeCard !== null &&
        activeCard.contains(document.activeElement);

      if (focusWasInside) {
        event.preventDefault();
        questionRefs.current[openIndex]?.focus();
      }

      setOpenIndex(null);
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
      true,
    );
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
        true,
      );
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openIndex]);

  const toggleItem = (index: number) => {
    setOpenIndex((previous) =>
      previous === index ? null : index,
    );
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "980px",
          boxSizing: "border-box",
          margin: "0 auto",
          padding: "40px 20px 30px",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            marginBottom: "32px",
            fontSize: "clamp(28px, 4vw, 42px)",
          }}
        >
          {t.faqTitle}
        </h1>

        <div
          lang={answersLanguage}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            const questionId = `faq-question-${index}`;
            const answerId = `faq-answer-${index}`;

            return (
              <div
                key={`${normalizedLang}-${index}`}
                ref={isOpen ? activeCardRef : null}
                style={{
                  border: "1px solid #d9d9d9",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "#fff",
                  boxShadow: isOpen
                    ? "0 6px 18px rgba(0,0,0,0.06)"
                    : "none",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "inherit",
                  }}
                >
                  <button
                    ref={(element) => {
                      questionRefs.current[index] = element;
                    }}
                    id={questionId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => toggleItem(index)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: isOpen ? "#f2f2f2" : "#fff",
                      padding: "18px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      fontFamily: "inherit",
                      fontSize: "17px",
                      fontWeight: 600,
                      lineHeight: 1.5,
                      color: "#1f1f1f",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{item.question}</span>

                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: "24px",
                        flexShrink: 0,
                      }}
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h2>

                <div
                  id={answerId}
                  aria-labelledby={questionId}
                  hidden={!isOpen}
                  style={{
                    padding: "18px 20px",
                    borderTop: "1px solid #eee",
                    color: "#444",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    fontSize: "16px",
                  }}
                >
                  {item.answer}
                </div>
              </div>
            );
          })}
        </div>

        <p
          style={{
            marginTop: "26px",
            textAlign: "center",
            color: "#666",
            fontSize: "14px",
          }}
        >
          {t.closeOnClickOutside}
        </p>
      </main>

      <Footer lang={normalizedLang} />
    </div>
  );
}