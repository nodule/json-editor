on.input.in = function() {
  var errors = $.editor.validate($.in);
  if(errors.length) {
    output({errors: $.create(errors)});
  } else {
    output({out: $.get('in')});
  }
};
