state.jsonEditor = null;
state.changeHandler = function() {
    output({out: $.clone('in', state.jsonEditor.getValue())});
};

on.input.in = function() {
  state.in = $.in;
  if (state.jsonEditor) {
    state.jsonEditor.setValue(state.in);
  }
};

on.input.schema = function() {
  state.schema = $.options.schema = $.schema;
  if (state.jsonEditor) {
    state.jsonEditor.off('change', state.changeHandler);
    state.jsonEditor.destroy();
  }
  state.jsonEditor = new json_editor($.element, $.options);
  // problem if state.in is not about this schema..
  state.jsonEditor.on('ready', function() {
    if (state.in) {
      state.jsonEditor.setValue(state.in);
    }
    state.jsonEditor.on('change', state.changeHandler);
    output({editor: $.create(state.jsonEditor)});
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
