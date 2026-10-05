import coin from "../assets/Coint1.png";

const css = `
@keyframes forum-logo-spin {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
}
.forum-logo-spin {
  animation: forum-logo-spin 4s linear infinite;
  perspective: 1000px;
}
`;

export default function ForumLogo({ size = 40 }: { size?: number }) {
  return (
    <>
      <style>{css}</style>
      <img
        src={coin}
        alt="Logo"
        className="forum-logo-spin"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
        }}
      />
    </>
  );
}
