state.jsonEditor = null;
state.changeHandler = function() {
    output({out: state.jsonEditor.getValue()});
};

on.input.in = function() {
  state.in = data;
  if (state.jsonEditor) {
    state.jsonEditor.setValue(state.in);
  }
};

on.input.schema = function() {
  state.schema = input.options.schema = input.schema;
  if (state.jsonEditor) {
    state.jsonEditor.off('change', state.changeHandler);
    state.jsonEditor.destroy();
  }
  state.jsonEditor = new json_editor(input.element, input.options);
  // problem if state.in is not about this schema..
  state.jsonEditor.on('ready', function() {
    if (state.in) {
      state.jsonEditor.setValue(state.in);
    }
    state.jsonEditor.on('change', state.changeHandler);
    output({editor: state.jsonEditor});
  });
};

on.input.enable = function() {
  if (state.jsonEditor) {
    state.jsonEditor.enable();
  }
};

on.input.disable = function() {
  if (state.jsonEditor) {
    state.jsonEditor.disable();
  }
};
