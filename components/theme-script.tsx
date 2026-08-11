const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("sledenje-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export function ThemeScript() {
  // eslint-disable-next-line react/no-danger -- inline pred-hidracijski skript, da se izognemo utripu napačne teme
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
