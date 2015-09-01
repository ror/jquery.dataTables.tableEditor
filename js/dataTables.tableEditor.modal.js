/*
 * ModalEditor
 *
 * https://github.com/eherve/dataTable-ModalEditor/blob/master/js/tableEditor.js
 */

(function (window, document) {

    var factory = function ($, DataTable) {

        var ModalEditor = function (config) {
            config = config || {};
            var self = this;
            // dom table
            if (!config.domTable) return alert("Missing editor domTable !");

            self.domTable = config.domTable;
            // method
            self.method = config.method || "POST";
            // url
            self.url = config.url || "";
            // id field
            self.idField = config.idField;
            // form validation
            self.formValidation = 'function' == typeof config.formValidation ?
                config.formValidation : function (data, callback) {
                callback();
            };

            // action
            self.done = config.done || this.done;
            self.fail = config.fail || this.fail;
            self.action = 'function' == typeof config.action ? config.action
                : function (data, next) {
                $.ajax({
                    type: self.method, url: self.url, data: JSON.stringify(data),
                    contentType: "application/json; charset=utf-8"
                })
                    .done(function () {
                        next();
                    })
                    .fail(function (err) {
                        next(err);
                    });
            };
            // fields
            self.fields = [];
            var size = config.fields && config.fields.length != undefined ?
                config.fields.length : 0;
            for (var index = 0; index < config.fields.length; ++index)
                self.fields.push(new Field(config.fields[index]));

            // modal
            self.buildModal(config);

            // button actions
            self.create = this._create.bind(self);
            self.edit = this._edit.bind(self);
            self.remove = this._remove.bind(self);
            self.setError = function (err) {
                self.errorBlock.text(err || '');
                if (err) self.errorBlock.fadeIn();
                else self.errorBlock.fadeOut();
            }
        };

        // Modal
        ModalEditor.prototype = {

            buildModal: function (config) {
                var self = this;
                self.modal = $('<div class="modal fade" tabindex="-1" role="dialog"' +
                    ' aria-hidden="true"/>').appendTo($(self.domTable));
                var dialog = $('<div class="modal-dialog"/>').appendTo($(self.modal));
                var content = $('<div class="modal-content"/>').appendTo($(dialog));

                // header
                var modalHeader = $('<div class="modal-header"/>').appendTo(content);
                $('<button type="button" class="close" data-dismiss="modal"' +
                    ' aria-hidden="true">&times</button>').appendTo(modalHeader);
                $('<h3/>').appendTo(modalHeader).text(config.title || '');

                // body
                var modalBody = $('<div class="modal-body"/>').appendTo(content);
                self.form = $('<form class="form-horizontal"/>')
                    .appendTo(modalBody).attr('method', self.method).attr('url', self.url);

                // fields
                for (var index = 0; index < self.fields.length; ++index) {
                    var field = self.fields[index];
                    if (field && !field.error) self.form.append(field.html);
                }
                self.errorBlock = $('<div class="alert alert-error hide">')
                    .appendTo(modalBody);
                self.error = $('<span id="error-span"/>').appendTo(self.errorBlock);

                // footer
                var modalFooter = $('<div class="modal-footer"/>').appendTo(content);
                $('<button class="btn", data-dismiss="modal", aria-hidden="true"/>')
                    .appendTo(modalFooter).text(config.closeText || '');
                self.validateButton =
                    $('<button class="btn btn-primary"/>').appendTo(modalFooter)
                        .text(config.validateText || '');

                self.modal.on('hide', function () {
                    self.validateButton.off('click');
                    self.errorBlock.text("");
                    self.errorBlock.fadeOut();
                    for (var index = 0; index < self.fields.length; ++index) {
                        var field = self.fields[index];
                        if (field) {
                            field.setError();
                            field.clear();
                        }
                    }
                });
            },

            // Button Actions
            _create: function () {
                var self = this;
                this.loadFields.call(self, null, function () {
                    self.validateButton.on('click', function () {
                        var data = self.retrieveData.call(self);

                        self.validateFields.call(self, function (valid) {
                            if (!valid) return;
                            self.formValidation.call(self, data, function (err) {
                                if (err) return self.setError(err);
                                self.action(data, self.finishedHandler.bind(self));
                            });
                        });
                    });
                    self.modal.modal();
                });
            },

            _edit: function (selectedRowData) {
                var self = this;
                this.loadFields.call(self, selectedRowData, function () {
                    for (var index = 0; index < self.fields.length; ++index) {
                        var field = self.fields[index];
                        if (field) {
                            field.setData(selectedRowData);
                            field.updateEnabled(selectedRowData);
                        }
                    }
                    self.validateButton.on('click', function () {
                        var data = self.retrieveData.call(self);

                        self.validateFields.call(self, function (valid) {
                            if (!valid) return;
                            self.formValidation.call(self, data, function (err) {
                                if (err) return self.setError(err);
                                if (self.idField && selectedRowData) data.id = selectedRowData[self.idField];
                                self.action(data, self.finishedHandler.bind(self));
                            });
                        });
                    });
                    self.modal.modal();
                });
            },

            _remove: function (selectedRowsData) {
                var self = this;
                this.loadFields.call(self, selectedRowsData, function () {
                    self.validateButton.on('click', function () {
                        var data = {ids: []};
                        if (self.idField && selectedRowsData)
                            for (var index = 0; index < selectedRowsData.length; ++index)
                                data.ids.push(selectedRowsData[index][self.idField]);
                        self.action(data, self.finishedHandler.bind(self));
                    });
                    self.modal.modal();
                });
            },

            loadFields: function (selected, callback) {
                var index = 0;
                var fields = this.fields;
                (function exec(err) {
                    if (err) console.error(err);
                    if (index >= fields.length) return callback();
                    var field = fields[index++];
                    if (field && field.isLoaded() === false) field.load(selected, exec);
                    else exec();
                })();
            },

            validateFields: function (callback) {
                var index = 0;
                var fields = this.fields;
                var valid = true;
                (function exec() {
                    if (index >= fields.length) return callback(valid);
                    var field = fields[index++];
                    if (field) field.validate(function (err) {
                        if (err) valid = false;
                        field.setError(err);
                        exec();
                    });
                    else exec();
                })();
            },

            retrieveData: function () {
                var data = {};
                for (var index = 0; index <= this.fields.length; ++index) {
                    var field = this.fields[index];
                    if (field && field.name && field.getData != undefined)
                        this.addToData(data, field.name, field.getData());
                }
                return data;
            },

            addToData: function (data, key, value) {
                var obj = data;
                var index = -1;
                while ((index = key.indexOf('.')) != -1) {
                    var base = key.substr(0, index);
                    key = key.substr(index + 1);
                    var element = obj[base];
                    if (element == undefined) element = obj[base] = {};
                    obj = element;
                }
                obj[key] = value;
            },

            // Request over method
            finishedHandler: function (err) {
                if (err) this.fail(err);
                else this.done();
            },

            done: function () {
                this.modal.modal('hide');
                TableTools.fnGetInstance(this.domTable.substring(1)).fnSelectNone();
                $(this.domTable).dataTable().fnReloadAjax();
            },

            fail: function (jqXHR) {
                if (jqXHR.status == 403) {
                    this.setError(jqXHR.responseText);
                } else if (jqXHR.status == 422) {
                    try {
                        var errors = JSON.parse(jqXHR.responseText);
                        for (var index = 0; index < this.fields.length; ++index) {
                            var field = this.fields[index];
                            if (field) {
                                field.setError(errors[field.name]);
                                delete errors[field.name];
                            }
                        }
                        for (var key in errors) console.log("Undisplayed error:", key, "=", errors[key]);
                    } catch (err) {
                        console.error(err);
                        this.setError(jqXHR.responseText);
                    }
                } else {
                    document.open();
                    document.write(jqXHR.responseText);
                    document.close();
                }
            },

            /*
             * Field
             */

            Field: function (config) {
                config = config || {};
                this.id = config.id;
                this.type = config.fieldType || 'label';
                this.label = config.label;
                this.name = config.name;
                this.options = config.options || {};
                if (this.type == 'field') this.component = config.component;
                else this.buildComponent.call(this);

                this.html = this.component ? this.component.html || this.component : "";

                this.isLoaded = function () {
                    return this.component.loaded !== false;
                };

                this.load = function (data, cb) {
                    if (this.isLoaded()) return cb();
                    if ('function' != typeof this.component.load) {
                        this.component.load = true;
                        return cb();
                    }
                    this.component.load.call(this, data, cb);
                };

                this.setError = function (err) {
                    if (this.component.error) {
                        if (err) this.component.html.addClass('error');
                        else this.component.html.removeClass('error');
                        this.component.error.html(err || '');
                    }
                };

                this.validate = function (callback) {
                    if (typeof this.options.validator != 'function') return callback();
                    this.options.validator(this.getData(), callback);
                };

                this.setData = function (data) {
                    if ('function' == typeof config.setData) {
                        config.setData.call(this, data);
                    } else if ('function' == typeof this.component.setData && this.name != undefined) {
                        var chunk = this.name.split('.'), val = data;
                        for (var index = 0; index < chunk.length && val != undefined; ++index) {
                            val = val[chunk[index]];
                        }
                        this.component.setData(val);
                    } else return;
                };

                this.clear = function () {
                    if ('function' == typeof config.clear) config.clear();
                    else if ('function' == typeof this.component.clear) this.component.clear();
                    else return;
                    this.updateEnabled();
                };

                this.getData = 'function' == typeof config.getData ?
                    config.getData : 'function' == typeof this.component.getData ?
                    this.component.getData.bind(this.component) : undefined;

                this.updateEnabled = function (data) {
                    if ('boolean' == typeof this.options.enabled) {
                        if (this.options.enabled === false)
                            this.component.input.attr('disabled', "disabled");
                        else this.component.input.removeAttr('disabled');
                    } else if ('function' == typeof this.options.enabled) {
                        if (!this.options.enabled.call(this, data))
                            this.component.input.attr('disabled', "disabled");
                        else this.component.input.removeAttr('disabled');
                    }
                };
                this.updateEnabled();
            },

            buildComponent: function () {
                this.component = {html: $('<div class="control-group"/>')};
                if (this.type == 'label') this.buildLabel.call(this);
                else if (this.type == 'legend') this.buildLegend.call(this);
                else if (this.type == 'input') {
                    if (this.options.type == 'text') this.buildSimpleInput.call(this, this.options.type);
                    else if (this.options.type == 'password') this.buildSimpleInput.call(this, this.options.type);
                    else if (this.options.type == 'date') this.buildSimpleInput.call(this, this.options.type);
                    else if (this.options.type == 'checkbox') this.buildInputCheckbox.call(this);
                    else if (this.options.type == 'textarea') this.buildInputTextarea.call(this);
                    else if (this.options.type == 'select') this.buildInputSelect.call(this);
                    else return console.error("Input field type", this.options.type, "not managed !");
                } else if (this.type == 'div') this.buildDiv.call(this);
                else if (this.type == 'button') this.buildButton.call(this);
                else return console.error("Field type", this.type, "not managed !");
                if (this.component.input) {
                    if (this.options.attr) for (var key in this.options.attr)
                        this.component.input.attr(key, this.options.attr[key]);
                    if (this.options.style) for (var key in this.options.style)
                        this.component.input.css(key, this.options.style[key]);
                }
            },

            buildLabel: function () {
                this.component.input = $('<label/>').text(this.label)
                    .appendTo(this.component.html);
            },

            buildLegend: function () {
                this.component.input = $('<legend/>').text(this.label)
                    .appendTo(this.component.html);
            },

            buildSimpleInput: function (type) {
                if (this.label)
                    $('<label class="control-label"/>').text(this.label)
                        .appendTo(this.component.html);
                var ctl = $('<div class="controls"/>').appendTo(this.component.html);
                this.component.input = $('<input type="' + type + '"/>').appendTo(ctl);
                this.component.error = $('<div class="error"/>').appendTo(ctl);
                this.component.setData = function (data) {
                    this.input.val(data != null ? data : "");
                };
                this.component.getData = function () {
                    return this.input.val();
                };
                this.component.clear = function () {
                    this.setData();
                }
            },

            buildInputCheckbox: function () {
                var ctl = $('<div class="controls"/>').appendTo(this.component.html);
                this.component.input = $('<input type="checkbox"/>')
                    .appendTo($('<label class="checkbox"/>')
                        .appendTo(ctl));
                if (this.label) this.component.input.after(this.label);
                this.component.error = $('<div class="error"/>').appendTo(ctl);
                this.component.setData = function (data) {
                    this.input.prop('checked', data || false);
                };
                this.component.getData = function () {
                    return this.input.prop('checked');
                };
                this.component.clear = function () {
                    this.input.removeAttr('checked');
                };
                if ('function' == typeof this.options.change) {
                    var self = this;
                    self.component.input.bind('change', function (event) {
                        return self.options.change.call(this, event);
                    });
                }
            },

            buildInputTextarea: function () {
                if (this.label)
                    $('<label class="control-label"/>').text(this.label)
                        .appendTo(this.component.html);
                var ctl = $('<div class="controls"/>').appendTo(this.component.html);
                this.component.input = $('<textarea/>').appendTo(ctl);
                this.component.error = $('<div class="error"/>').appendTo(ctl);
                this.component.setData = function (data) {
                    this.input.val(data || "");
                };
                this.component.getData = function () {
                    return this.input.val();
                };
                this.component.clear = function () {
                    this.setData();
                }
            },

            buildInputSelect: function () {
                var self = this;
                if (self.label)
                    $('<self.label class="control-label"/>').text(self.label)
                        .appendTo(self.component.html);
                var ctl = $('<div class="controls"/>').appendTo(self.component.html);
                self.component.input = $('<select/>').appendTo(ctl);
                if (self.options.multiple === true) self.component.input.attr('multiple', 'multiple');
                else if (self.options.forbidEmpty !== true) self.component.input.append('<option/>');
                self.component.error = $('<div class="error"/>').appendTo(ctl);
                self.component.loaded = false;
                self.component.getData = function () {
                    if (self.component.input.attr('multiple') != null) {
                        var data = [];
                        self.component.input.find('option:selected').each(function () {
                            data.push($(this).attr('key'));
                        });
                    } else data = self.component.input.find('option:selected').attr('key');
                    return data || null;
                };
                self.component.setData = function (data) {
                    if (data == undefined) return self.component.input.find('option:selected')
                        .removeAttr('selected');
                    var equals = getEqualsFunction(self.options);
                    self.component.input.find('option').each(function () {
                        if (typeof data == "object" && data.length != undefined) {
                            for (var index = 0; index < data.length; ++index) {
                                if (equals($(this).attr('key'), data[index])) {
                                    return $(this).attr('selected', 'selected');
                                }
                            }
                        } else if (equals($(this).attr('key'), data))
                            return $(this).attr('selected', 'selected');
                        $(this).removeAttr('selected');
                    });
                };
                self.component.load = function (selected, callback) {
                    if (!self.options.src && !self.options.values) return callback();
                    loadValues(selected, self.options.src || self.options.values, function (err, data) {
                        if (err) return callback(err);
                        self.component.input.empty();
                        if (self.component.input.attr('multiple') == null &&
                            self.options.forbidEmpty !== true) self.component.input.append('<option/>');
                        if (!data) return;
                        for (var index = 0; index < data.length; ++index) {
                            var d = data[index];
                            if (d) self.component.input.append($('<option/>')
                                .attr('key', d.key).text(d.value));
                        }
                        self.loaded = true && self.options.alwaysReload !== true;
                        callback();
                    });
                };
            },

            buildDiv: function () {
                var self = this;
                //var ctl = $('<div class="controls"/>').appendTo(self.component.html);
                self.component.input = $('<div />').appendTo(self.component.html);
                this.component.clear = function () {
                    this.input.empty();
                }
            },

            buildButton: function () {
                var self = this;
                var ctl = $('<div class="controls"/>').appendTo(self.component.html);
                self.component.input = $('<button />').text(self.label).appendTo(ctl);
                self.component.input.bind('click', function (event) {
                    event.preventDefault();
                    self.options.onclick.call(this, event);
                    return false;
                });
            },

            getEqualsFunction: function (options) {
                var equals;
                if (typeof options.equals == 'function') equals = options.equals;
                else if (typeof options.keyField == 'string') {
                    equals = function (key, val) {
                        return key == val[options.keyField];
                    };
                } else {
                    equals = function (key, val) {
                        return key == val;
                    };
                }
                return equals;
            },

            loadValues: function (selected, src, callback) {
                if (typeof src == 'string') loadAjaxValues(src, callback);
                else if (typeof src == 'function') src(selected, callback);
                else if (typeof src == 'object') callback(null, src);
                else console.error("Load field value unknown source type:", src);
            },

            loadAjaxValues: function (url, callback) {
                $.ajax({
                    dataType: "json", type: "GET", url: url,
                    success: function (data) {
                        callback(null, data);
                    },
                    error: function (err) {
                        callback(err);
                    }
                });
            }
        };

        /*
         * Extend DataTable
         */

        $.fn.dataTableExt.oApi.fnReloadAjax = function (oSettings, sNewSource) {
            this.fnDraw();
        };

        /*
         * Extend TableTool
         */

        //TableTools.BUTTONS.new_button =
        //    $.extend(true, "new_button", TableTools.buttonBase, {
        //        sButtonType: 'new',
        //        sButtonText: "New",
        //        sButtonClass: "btn",
        //        bIsEnabled: true,
        //        bIsVisible: true,
        //        editor: null,
        //        fnInit: initButton,
        //        bShowIcon: true,
        //        sIconClass: 'icon-pencil',
        //        fnClick: create
        //    });
        //
        //TableTools.BUTTONS.edit_button =
        //    $.extend(true, "edit_button", TableTools.buttonBase, {
        //        sButtonType: 'edit',
        //        sButtonText: "Edit",
        //        sButtonClass: "btn disabled",
        //        fnSelect: ActifSelectSingle,
        //        bIsEnabled: true,
        //        bIsVisible: true,
        //        editor: null,
        //        fnInit: initButton,
        //        bShowIcon: true,
        //        sIconClass: 'icon-edit',
        //        fnClick: edit
        //    });
        //
        //TableTools.BUTTONS.remove_button =
        //    $.extend(true, "remove_button", TableTools.buttonBase, {
        //        sButtonType: 'remove',
        //        sButtonText: "Remove",
        //        sButtonClass: "btn disabled",
        //        fnSelect: ActifSelect,
        //        bIsEnabled: true,
        //        bIsVisible: true,
        //        editor: null,
        //        fnInit: initButton,
        //        bShowIcon: true,
        //        sIconClass: 'icon-trash',
        //        fnClick: remove
        //    });
        //
        function initButton(nButton, oConfig) {
            if (oConfig.bShowIcon !== false && oConfig.sIconClass != null) {
                $(nButton).prepend('<i class="' + oConfig.sIconClass + '" style="padding-right:5px;"/>')
            }
            var selectedData = [];
            if (isVisible(oConfig, selectedData, nButton))
                $(nButton).css('display', '');
            else $(nButton).css('display', 'none');
            if (oConfig.sButtonType == 'new' &&
                isEnabled(oConfig, selectedData, nButton))
                $(nButton).removeClass('disabled');
            else $(nButton).addClass('disabled');
        }

        function ActifSelectSingle(button, config, rows) {
            var selectedData = this.fnGetSelectedData();
            if (isVisible(config, selectedData, button))
                $(button).css('display', '');
            else $(button).css('display', 'none');
            if (isEnabled(config, selectedData, button) && selectedData.length == 1)
                $(button).removeClass('disabled');
            else $(button).addClass('disabled');
        }

        function ActifSelect(button, config, rows) {
            var selectedData = this.fnGetSelectedData();
            if (isVisible(config, selectedData, button))
                $(button).css('display', '');
            else $(button).css('display', 'none');
            if (isEnabled(config, selectedData, button) && selectedData.length > 0)
                $(button).removeClass('disabled');
            else $(button).addClass('disabled');
        }

        //
        function isEnabled(config, selectedData, button) {
            if (config.bIsEnabled === true) return true;
            if ('function' == typeof config.bIsEnabled)
                return config.bIsEnabled(selectedData, button);
            return false;
        }

        function isVisible(config, selectedData, button) {
            if (config.bIsVisible === true) return true;
            if ('function' == typeof config.bIsVisible)
                return config.bIsVisible(selectedData, button);
            return false;
        }

        function create(nButton, oConfig, oFlash) {
            if (!$(nButton).hasClass('disabled') && oConfig.editor && oConfig.editor.create)
                oConfig.editor.create();
        }

        function edit(nButton, oConfig, oFlash) {
            if (!$(nButton).hasClass('disabled') && oConfig.editor && oConfig.editor.edit) {
                var selectedData = this.fnGetSelectedData();
                if (selectedData.length != 1)
                    return console.error("Internal Error: edit cannot be called against more or less than 1 row !");
                selectedData = selectedData[0];
                oConfig.editor.edit(selectedData);
            }
        }

        function remove(nButton, oConfig, oFlash) {
            if (!$(nButton).hasClass('disabled') && oConfig.editor && oConfig.editor.remove) {
                var selectedData = this.fnGetSelectedData();
                oConfig.editor.remove(selectedData);
            }
        }

        /*
         * Register a new feature with DataTables
         */
        //if (typeof $.fn.dataTable == "function" &&
        //  typeof $.fn.dataTableExt.fnVersionCheck == "function" &&
        //  $.fn.dataTableExt.fnVersionCheck('1.9.0')) {
        //  $.fn.dataTableExt.aoFeatures.push({
        //    "fnInit": function (oDTSettings) {
        //      var oOpts = typeof oDTSettings.oInit.oTableTools != 'undefined' ?
        //        oDTSettings.oInit.oTableTools : {};
        //
        //      var oTT = new TableTools(oDTSettings.oInstance, oOpts);
        //      TableTools._aInstances.push(oTT);
        //
        //      return oTT.dom.container;
        //    },
        //    "cFeature": "T",
        //    "sFeature": "TableTools"
        //  });
        //}
        //else {
        //  alert("Warning: TableTools 2 requires DataTables 1.9.0 or newer - www.datatables.net/download");
        //}

        $.fn.dataTable.ModalEditor = ModalEditor;
        $.fn.DataTable.ModalEditor = ModalEditor;


        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * Initialisation
         */

        // DataTables creation - check if the ModalEditor have been defined for this table,
        // they will have been if the `B` option was used in `dom`, otherwise we should
        // create the ModalEditor instance here so they can be inserted into the document
        // using the API

        $(document).on( 'init.dt.dte', function (e, settings, json) {
            if ( e.namespace !== 'dt' ) {
                return;
            }

            var opts = settings.oInit.editor || DataTable.defaults.editor;

            if ( opts && ! settings._editor ) {
                new ModalEditor( settings ); //.container();
            }
        } );

        return ModalEditor;
    }; // /factory


    // Define as an AMD module if possible
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'datatables'], factory);
    }
    else if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('jquery'), require('datatables'));
    }
    else if (jQuery && !jQuery.fn.dataTable.ModalEditor) {
        // Otherwise simply initialise as normal, stopping multiple evaluation
        factory(jQuery, jQuery.fn.dataTable);
    }
})(window, document);
