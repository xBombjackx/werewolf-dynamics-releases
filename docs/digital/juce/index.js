// Served as dist/juce/index.js — the module the plugin UI imports when it
// sees window.__JUCE__. Delegates to the web host built by boot.js, so the
// UI file itself stays byte-identical with the plugin's resource.

const host = window.__WD_WEB_HOST__;

export const getSliderState = id => host.sliderState(id);
export const getComboBoxState = id => host.comboState(id);
export const getToggleState = id => host.toggleState(id);
export const getNativeFunction = name => host.nativeFunction(name);
