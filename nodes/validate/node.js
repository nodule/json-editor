on.input.in = function() {
  var errors = $.editor.validate($.in);
  if(errors.length) {
    output({errors: errors});
  } else {
    output({out: $.in});
  }
};
