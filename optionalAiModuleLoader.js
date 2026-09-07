const MODULES = [
  './sceneMotionSuggestionUi.js',
  './sceneTransitionSuggestionUi.js',
  './sceneImageSuggestionUi.js'
];

for (const modulePath of MODULES) {
  import(modulePath).catch(error => {
    console.warn(`Optional AI module failed to load: ${modulePath}`, error);
  });
}
