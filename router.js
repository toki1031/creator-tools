export function readRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [page, id] = hash.split("/");
  return page === "project" && id ? { page: "project", id } : { page: "home" };
}
export function goHome() { location.hash = "#/"; }
export function goProject(id) { location.hash = `#/project/${encodeURIComponent(id)}`; }
