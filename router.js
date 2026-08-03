export function readRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [page, id, subpage] = hash.split("/");
  if (page === "studio" && id) return { page: "studio", studio: id };
  if (page === "project" && id && subpage === "scenes") return { page: "scenes", id: decodeURIComponent(id) };
  if (page === "project" && id) return { page: "project", id: decodeURIComponent(id) };
  return { page: "home" };
}
export function goHome() { location.hash = "#/"; }
export function goStudio(studio) { location.hash = `#/studio/${encodeURIComponent(studio)}`; }
export function goProject(id) { location.hash = `#/project/${encodeURIComponent(id)}`; }
export function goScenes(id) { location.hash = `#/project/${encodeURIComponent(id)}/scenes`; }
