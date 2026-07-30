export type Route = { page: "home" } | { page: "project"; id: string };

export function readRoute(): Route {
  const hash = location.hash.replace(/^#\/?/, "");
  const [page, id] = hash.split("/");
  return page === "project" && id ? { page: "project", id } : { page: "home" };
}

export function goHome(): void { location.hash = "#/"; }
export function goProject(id: string): void { location.hash = `#/project/${id}`; }
