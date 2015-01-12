on.input.in = function() {
  state.in = data;
  if (state.jsonEditor) {
    state.jsonEditor.setValue(state.in);
  }
};

on.input.schema = function() {
  state.schema = input.options.schema = input.schema;
  if (state.jsonEditor) {
    state.jsonEditor.destroy();
  }
  state.jsonEditor = json_editor(input.element, input.options);
  // problem if state.in is not about this schema..
  if (state.in) {
    state.jsonEditor.setValue(state.in);
  }
  state.jsonEditor.on('change', function() {
    output({out: state.jsonEditor.getValue()});
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