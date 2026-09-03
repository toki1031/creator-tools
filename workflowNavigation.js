const PREVIOUS_WORKFLOW_PAGE = Object.freeze({
  ai: 'studio',
  project: 'studio',
  scenes: 'project',
  bgm: 'scenes',
  output: 'bgm',
  publish: 'output'
});

export function previousWorkflowPage(page = '') {
  return PREVIOUS_WORKFLOW_PAGE[String(page)] || 'studio';
}
