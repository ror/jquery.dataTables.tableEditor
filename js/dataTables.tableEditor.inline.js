/**
 * @project DataTables TableEditor
 * @maintainer MoJie
 * @version 0.0.1
 * @contributor MoJie
 * @file dataTables.tableEditor.inline.js
 * @copyright Copyright 2014-2015 MoJie, all rights reserved.
 *
 * This source file is free software, under either the GPL v2 license or a
 * BSD style license, as supplied with this software.
 *
 * This source file is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 */

(function (window, document) {
    "use strict";
    var factory = function ($, DataTable) {

        /**
         * TableEditor给数据表格添加了编辑功能，让用户很容易就能编辑表格数据。
         *
         * 可以采取以下几种初始化方法：
         * - 添加 `editable: true` 到表格设置或默认表格设置
         *
         * @example
         *      $('#example').dataTable( {
         *          "editable": true,
         *      } );
         *
         * - 添加样式类属性 'editable' 或 'dt-editable' 到html表格
         *
         * @example
         *      <table id="example" class="display editable" cellspacing="0" width="100%"></table>
         *
         * - 添加数据属性 'data-editable = true' 到 html 表格
         *
         * @example
         *      <table id="example" class="display" data-editable="true" cellspacing="0" width="100%"></table>
         *
         *  @class
         *  @constructor
         *  @global
         *  @param {object} dt DataTables设置对象
         *  @param {object} [init={}] TableEditor 的设置对象，选项定义在 {@link TableEditor.defaults}
         *
         *
         *  @requires jQuery 1.7+
         *  @requires DataTables 1.10.8+
         */

        var TableEditor = function (dt, init) {
            var self = this;

            // 正常检查
            // 检查 DataTables 版本，是否 1.10.8 或更新
            if (!DataTable.versionCheck || !DataTable.versionCheck('1.10.8')) {
                throw 'DataTables TableEditor requires DataTables 1.10.8 or newer';
            }

            // 检查 `TableEditor` 是否已经初始化
            if (dt.editable) {
                return;
            }

            // 如果没有设置，初始化 `TableEditor` 设置
            if (typeof init == 'undefined') {
                init = {};
            }

            // 使用 `DataTables.camelToHungarian` 标记映射方法, 提供驼峰变量
            if ($.fn.DataTable.camelToHungarian) {
                $.fn.DataTable.camelToHungarian(TableEditor.defaults, init);
            }

            // 获得 `DataTables` 设置
            var dtSettings = $.fn.DataTable.Api ? new $.fn.DataTable.Api(dt).settings()[0] : dt.settings();

            // 附加 `TableEditor`实例给 `DataTables`实例设置，方便调用
            dtSettings._tableEditor = this;

            // 定义的一个全局变量，方便调用
            this.s = {
                dt: new $.fn.DataTable.Api(dt)
            };

            // 查询已经删除和有状态的列，以便保存索引，供后面使用
            $.each(dtSettings.aoColumns, function (index, settings) {
                if (settings.mData == "deleted" || settings.data == "deleted" || settings.name == "deleted") {
                    self.s.deletedIdx = settings.idx;
                }
                if (settings.mData == "status" || settings.data == "status" || settings.name == "status") {
                    self.s.statusIdx = settings.idx;
                }
            });

            // 构建实例
            if (!dtSettings._bInitComplete) {
                dtSettings.oApi._fnCallbackReg(dtSettings, 'aoInitComplete', function () {
                    self._construct(init);
                });
            }
            else {
                this._construct(init);
            }
        }; //TableEditor

        // 定义TableEditor的私有方法（js没有私有方法，只不过这些方法，建议不要直接调用）
        TableEditor.prototype = {
            /**
             *  构造器：检查、验证、注册事件等，整个流程
             *  @returns {void}
             *  @private
             */
            _construct: function (init) {
                var self = this;

                // 保存表单数据到 `_startingValues`
                this._dataSaved();

                // 设置锁定和已公布的属性与类
                self._checkStatus();

                // 注册事件
                // 附加 `draw` 事件，当表格改变时检查状态
                $(this.s.dt.table().node()).on('draw.dt', function (e, settings) {
                    self._checkStatus();
                });

                $(this.s.dt.table().node()).on('click', 'i[data-action="unlock"]', function (e) {
                    e.stopPropagation();
                });

                $(this.s.dt.table().node()).on('save.dt.editable', function (e) {
                    self._updateRowState($(self.s.dt.row(e.rowIndex)));
                });

                $(this.s.dt.table().node()).on('click', 'i[data-action="delete"]', function (e) {
                    e.stopPropagation();
                    self._deleteRow(self.s.dt.row($(this).closest('tr')));
                });

                // fixme extend button: 添加 ADD，EDIT，DELETE，LOCK/UNLOCK 等4个按钮
                // $(document).on('click', '[data-action="addRow"]', function (e) {
                $(document).on('click', 'a.buttons-add', function (e) {
                    e.stopPropagation();
                    self._addRow();
                });

                // 点击文档（空白）区域，做各种恢复处理
                $(document).on('click', function (e) {
                    var $target = $(e.target),
                        $table = $(self.s.dt.table().node()),
                        $activeRow = $table.find('tr.editing'),
                        $inputs,
                        $form;

                    // 如果不能编辑，尽快返回
                    if ($activeRow.length == 0) {
                        return;
                    }

                    // fixme 如果点击了带有 `data-action="addRow"` 属性的元素，返回
                    if ($target.attr('data-action') === 'addRow') {
                        return;
                    }

                    // 如果点击的行正被编辑或是它的子行在编辑，返回
                    if ($target.hasClass('editing') || $target.closest('tr.editing').length > 0) {
                        return;
                    }

                    $inputs = $activeRow.find('input');
                    $form = $table.closest('form');

                    // 找到活动的行并保存它，然后恢复
                    if ($inputs.filter(function () {
                            return $(this).val()
                        }).length == 0) {
                        $activeRow.remove();
                        return;
                    }

                    if ($inputs.length > 0 && ($form.length === 0 || $form.valid())) {
                        self._callSaveHandler(self.s.dt, $activeRow);
                    }
                });

                $(document).on('keypress', function (e) {
                    var key = e.which;
                    if (key === 13) {
                        var $inputs = $('table.dataTable tr.editing input'),
                            $row = $inputs.closest('tr'),
                            $table = $row.closest('table'),
                            $form = $table.closest('form'),
                            dt = $table.DataTable();

                        if ($inputs.filter(function () {
                                return $(this).val()
                            }).length == 0) {
                            $row.remove();
                            return;
                        }

                        if ($table.find('tr.editing').length > 0 && $inputs.length > 0 && ($form.length === 0 || $form.valid())) {
                            dt.settings()[0]._tableEditor._callSaveHandler(dt, $row);
                        }
                    }
                });
            },

            _checkStatus: function (rows) {
                var self = this;

                // 如果行是未定义的，则将其设置为应用筛选器的当前行。
                if (typeof rows == 'undefined') {
                    rows = this.s.dt.rows({"page": "current", "filter": "applied"});
                }

                rows.iterator('row', function (context, index) {
                    // 确保状态存在
                    var row = this.row(index),
                        status = row.data().status;
                    if (status == 0) { //解锁、未发布 - 编辑状态
                        self._unlockRow(row);
                        self._unpublishRow(row);
                    }
                    if (status == 1) { //锁定
                        self._lockRow(row);
                    }
                    if (status == 2) { //发布
                        self._publishRow(row);
                    }
                });
            },
            _lockRow: function (row) {
                $(row.node()).addClass('locked').attr('data-locked', true).attr('data-editable', false);
            },
            _unlockRow: function (row) {
                $(row.node()).removeClass('locked').attr('data-locked', false).attr('data-editable', true);
            },
            _publishRow: function (row) {
                $(row.node()).addClass('published').attr('data-published', true);
            },
            _unpublishRow: function (row) {
                $(row.node()).removeClass('published').attr('data-published', false);
            },
            _dataSaved: function () {
                $.extend(true, this._startingValues, this.s.dt.data().toArray());
            },
            _rollbackData: function () {
                var dt = this.s.dt;
                dt.rows().remove();
                $.each(this._startingValues, function (key, value) {
                    dt.row.add(value);
                });

                this._dirtyValues = {};
                dt.draw();
            },

            _updateRowState: function ($row) {
                var dt = this.s.dt,
                    row = dt.row($row),
                    startingData = this._startingValues[row.index()],
                    currentData = row.data();

                if (JSON.stringify(startingData) != JSON.stringify(currentData)) {
                    this._dirtyValues[row.index()] = row.data();
                } else {
                    var dirtyData = this._dirtyValues[row.index()];
                    if (typeof dirtyData !== 'undefined') {
                        delete this._dirtyValues[row.index()];
                    }
                }
            },
            _dirtyValues: {},
            _startingValues: {},
            _deleteRow: function (row) {
                var data = row.data(),
                    dt = this.s.dt;

                // 如果锁定（locked： 1）或已经发布（published： 2），返回
                if (data.status == 1 || data.status == 2) {
                    return this;
                }

                if (data.status === 0) {
                    dt.cell(row.index(), this.s.deletedIdx).data(1);

                    // 触发保存事件，将所有数据传递进入
                    $(dt.table().node()).trigger({
                        type: 'save.dt.editable',
                        rowIndex: row.index(),
                        rowData: row.data()
                    });
                }

                // 如果行未增加或未从数据源加载，清理掉`dirtyData`。
                if (data.status === 'undefined' || data.status === null) {
                    delete this._dirtyValues[row.index()];
                }

                row.remove().draw();

                return this;
            },

            /**
             *  获得当前被编辑行输入的当前数据，保存数据到 `datatable` 数据源，然后将被编辑的单元格变回没有输入状态的单元格
             *
             *  @event save.dataTableEditor 触发和传入行索引、行新数据
             *  @event click.dataTableEditor 删除事件监听事件
             *  @returns {void}
             *  @private
             */
            _callSaveHandler: function (dt, $row) {
                var $form = $row.closest('form'),
                    $cells = $row.find('td'),
                    rowData = {},
                    rowIdx = 0,
                    $table = $(dt.table().node()),
                    data;

                // 确保有输入
                if ($('input', $table).length < 1) {
                    return;
                }

                // 表单验证
                if ($form.length == 0 || $form.valid()) {
                    rowData = dt.row($row).data(),
                        rowIdx = dt.row($row).index();

                    // 序列化表单数据
                    // data = $form.serializeArray();
                    data = dt.table().$('input, select').serializeArray();

                    //
                    $.each(data, function () {
                        rowData[this.name] = this.value;
                    });

                    dt.row($row).data(rowData);

                    dt.draw(false);

                    //todo 保存到服务器
                    this._saveToServer(rowData);
                    //this._saveToServer(data);

                    // 触发保存事件，传入数据
                    $(dt.table().node()).trigger({
                        type: 'save.dt.editable',
                        rowIndex: rowIdx,
                        rowData: rowData
                    });

                    // 删除样式类 'editing'
                    $row.removeClass('editing');
                }
            },

            //ajax 到服务器
            _saveToServer: function (rowData) {
                var url = this.s.dt.settings()[0].oInit.ajaxUrl,
                    postUrl = url;

                //如果存在 `id`，那么就是更新或删除
                if (typeof rowData.id !== 'undefined') {
                    postUrl = url + "/" + rowData.id;
                }

                $.ajax({
                    //提交数据的类型 POST GET, 默认为 "GET"。注意：其它 HTTP 请求方法，如 PUT 和 DELETE 也可以使用，
                    // 但仅部分浏览器支持。
                    type: "POST",
                    //提交的网址
                    url: postUrl,
                    //提交的数据
                    data: rowData,
                    //返回数据的格式, "xml", "html", "script", "json", "jsonp", "text"
                    datatype: "json",
                    //在请求之前调用的函数
                    beforeSend: function () {
                        //$("#msg").html("logining");
                        console.log("start...");
                        console.log(rowData);
                    },
                    //成功返回之后调用的函数
                    success: function (data) {
                        //$("#msg").html();
                        //console.log(decodeURI(data));
                    },

                    //调用执行后调用的函数
                    complete: function (XMLHttpRequest, textStatus) {
                        //alert(XMLHttpRequest.responseText);
                        alert(textStatus);
                        console.log("finished!");
                        //HideLoading();
                    },
                    //调用出错执行的函数
                    error: function (e) {
                        //请求出错处理
                        console.log(e);
                    }
                });
            },

            _isEditable: function (dt, $cell) {
                var cellIdx = dt.cell($cell).index().column;
                if ($cell.attr('data-editable') == "false" || $cell.closest('tr').attr('data-editable') == "false") {
                    return false;
                }

                return dt.settings()[0].aoColumns[cellIdx].editable || $(dt.table().header()).find('th').eq(cellIdx).attr('data-editable') == "true";
            },

            // 单元格数据模板
            _getRowTemplate: function ($row, isNew) {
                var self = this,
                    dt = this.s.dt;

                if (typeof isNew == 'undefined') {
                    isNew = false;
                }

                // 查找每个`td`，并依据对应`th`的`data-input-type`类型，将其转化为输入框
                $row.find('td').each(function (key, value) {
                    var $cell = $(this);

                    if (isNew || self._isEditable(dt, $cell)) {

                        var cellIdx = dt.cell($cell).index().column;

                        var oCellSetting = dt.settings()[0].aoColumns[cellIdx],
                            $html;

                        if (dt.settings()[0].oInit.editor && dt.settings()[0].oInit.editor.type === 'modal') {
                            self._getModalTemplate($cell, oCellSetting);
                        } else {
                            self._getCellTemplate($cell, oCellSetting);
                        }
                    }
                });
            },

            _getModalTemplate: function ($cell, oCellSetting) {
                //console.log("modal");
                var dt = this.s.dt,
                    oInit = dt.settings()[0].oInit,
                    $cell = oCell,
                    sType = oCellSetting.type,
                    sName = oCellSetting.data,
                    oOptions = oCellSetting.options || {},
                    $html, template;

                //保存原始值
                var sText = $cell.text();

                switch (sType) {
                    //使用select2.js
                    case "select":
                    {
                        //确保引入select2.js
                        if (typeof $.fn.select2 === 'undefined') {
                            alert('Select2 has not been installed, please download it from https://select2.github.io/ !');
                        }

                        //添加select元素 - 必须先写入，不然后续无法使用
                        var $select = $cell.html($("<select name='" + sName + "'></select>")).find('select');

                        //构建select2
                        template = $select.select2(oOptions);

                        //设定当前值为默认选定值
                        template = $select.select2("val", sText);

                        break;
                    }
                    case "date" :
                    {
                        //确保引入bootstrap-datepicker.js,并且版本大于 `1.4.0`
                        if (typeof $.fn.datepicker === 'undefined' || !TableEditor.versionCheck($.fn.datepicker.version, "1.4.0")) {
                            alert('Bootstrap Datepicker has not been installed, please download it from https://github.com/eternicode/bootstrap-datepicker !');
                        }

                        // 默认使用 `input` 文本域
                        template = $('<input type="text" class="span12" name="' + sName + '" required>');

                        // 构建datepicker
                        template.datepicker(oOptions);

                        // 设定原值为默认值
                        $cell.html(template.val(sText));
                        break;
                    }
                    default:
                    {
                        template = $('<input type="text" class="span12" name="' + sName + '" required>');

                        if (template.is('input')) {
                            $html = template.val($cell.text());
                        } else {
                            template.find('input').val($cell.text());
                            $html = template;
                        }

                        $cell.html(template);
                        //break;
                    }
                }
            },

            _getCellTemplate: function (oCell, oCellSetting) {
                var dt = this.s.dt,
                    $cell = oCell,
                    sType = oCellSetting.type,
                    sName = oCellSetting.data,
                    oOptions = oCellSetting.options || {},
                    $html, template;

                //保存原始值
                var sText = $cell.text();

                switch (sType) {
                    //使用select2.js
                    case "select":
                    {
                        //确保引入select2.js
                        if (typeof $.fn.select2 === 'undefined') {
                            alert('Select2 has not been installed, please download it from https://select2.github.io/ !');
                        }

                        //添加select元素 - 必须先写入，不然后续无法使用
                        var $select = $cell.html($("<select name='" + sName + "'></select>")).find('select');

                        //构建select2
                        template = $select.select2(oOptions);

                        //设定当前值为默认选定值
                        template = $select.select2("val", sText);

                        break;
                    }
                    case "date" :
                    {
                        //确保引入bootstrap-datepicker.js,并且版本大于 `1.4.0`
                        if (typeof $.fn.datepicker === 'undefined' || !TableEditor.versionCheck($.fn.datepicker.version, "1.4.0")) {
                            alert('Bootstrap Datepicker has not been installed, please download it from https://github.com/eternicode/bootstrap-datepicker !');
                        }

                        // 默认使用 `input` 文本域
                        template = $('<input type="text" class="span12" name="' + sName + '" required>');

                        // 构建datepicker
                        template.datepicker(oOptions);

                        // 设定原值为默认值
                        $cell.html(template.val(sText));
                        break;
                    }
                    default:
                    {
                        template = $('<input type="text" class="span12" name="' + sName + '" required>');

                        if (template.is('input')) {
                            $html = template.val($cell.text());
                        } else {
                            template.find('input').val($cell.text());
                            $html = template;
                        }

                        $cell.html(template);
                        //break;
                    }
                }
            },

            _setFocus: function (dt, $row, $cell) {
                // 设置焦点，首选点击的单元格（可编辑的），否则放在第一个可编辑单元格上
                if (typeof $cell != 'undefined' && this._isEditable(dt, $cell)) {
                    $cell.find('input').focus();
                } else {
                    $row.find('input').eq(0).focus();
                }
            },

            _callDefaultEditHandler: function ($cell, $row, $table) {
                // 如果在编辑一行，在编辑另一行之前保存它
                var $inputs = $('input', $table),
                    dt = $table.DataTable(),
                    TableEditor = this;

                if ($inputs.length > 0 && ($inputs.closest('form').length == 0 || !$inputs.valid())) {
                    return;
                }

                $row.trigger('click.dt.editable');

                // 获得行模板
                this._getRowTemplate($row);
                //$.fn.dataTable.Editor.buildModal({title: "hello world"});

                // 添加类样式属性 'editing'
                $row.addClass('editing');

                this._setFocus(dt, $row, $cell);
            },

            _callUserDefinedEditHandler: function ($cell, $row, $table) {
                var namespaces = $table.attr('data-action-edit').split('.'),
                    editHandler = namespaces.pop(),
                    context;

                for (var i = 0; i < namespaces.length; i++) {
                    context = window[namespaces[i]];
                }

                // 调用编辑处理函数
                context[editHandler].call(this, $row, $table);
            },

            _addRow: function () {
                var dt = this.s.dt,
                    $table = $(dt.table().node()),
                    $row,
                    aData = [];

                // 如果有行在编辑，返回
                if ($('tr.editing', $table).length > 0) {
                    return;
                }

                // 不能使用 `append` 等方法操作表格，否则无法应用下面的模板
                $row = $(dt.row.add(aData).draw().node());
                $row.addClass('editing');

                this._getRowTemplate($row, true);
                this._setFocus(dt, $row);
            }
        }; // /TableEditor.prototype

        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * 默认配置
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
        TableEditor.defaults = {};

        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * 常量：
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
        TableEditor.version = "0.0.1";

        /**
         * 检测插件版本:
         *
         *  @param {string} current 当前版本号
         *  @param {string} target  目标版本号
         *  @returns {boolean} true 如果大于或等于限定版本，返回真
         *  @static
         *  @dtopt API-Static
         *
         *  @example
         *    alert( TableEditor.versionCheck(TableEditor.version， '0.1.0') ); //返回 false
         */
        TableEditor.versionCheck = function (current, target) {
            if (typeof current === 'undefined') {
                return false;
            }

            var aThis = current.split('.');
            var aThat = target.split('.');
            var iThis, iThat;

            for (var i = 0, iLen = aThat.length; i < iLen; i++) {
                iThis = parseInt(aThis[i], 10) || 0;
                iThat = parseInt(aThat[i], 10) || 0;

                // Parts are the same, keep comparing
                if (iThis === iThat) {
                    continue;
                }

                console.log(iThis);
                // Parts are different, return immediately
                return iThis > iThat;
            }

            return true;
        };

        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * 初始化
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

        // 附加 `TableEditor` 到 `DataTables` 作为 'extra' 被调用
        $.fn.DataTable.TableEditor = TableEditor;
        $.fn.dataTable.tableEditor = TableEditor;

        // DataTables 1.10.8 API 方法别名
        if ($.fn.DataTable.Api) {
            var Api = $.fn.DataTable.Api;

            Api.register('TableEditor()', function () {
                return this;
            });

            Api.register('TableEditor.addRow()', function () {
                this.settings()[0]._tableEditor._addRow();
                return this;
            });

            Api.register('TableEditor.getDirtyData()', function () {
                return this.settings()[0]._tableEditor._dirtyValues;
            });

            Api.register('TableEditor.dataSaved()', function () {
                this.settings()[0]._tableEditor._dataSaved();
                return this;
            });

            Api.register('TableEditor.rollbackData()', function () {
                this.settings()[0]._tableEditor._rollbackData();
                return this;
            });

            Api.register('TableEditor.updateRowState()', function ($row) {
                this.settings()[0]._tableEditor._updateRowState($row);
                return this;
            });

            Api.register('TableEditor.lockRows()', function () {
                this.iterator('row', function (context, index) {
                    this.cell(index, this.settings()[0]._tableEditor.s.statusIdx).data(1);
                });
                return this;
            });

            Api.register('TableEditor.unlockRows()', function () {
                this.iterator('row', function (context, index) {
                    this.cell(index, this.settings()[0]._tableEditor.s.statusIdx).data(0);
                });
                return this;
            });

            Api.register('TableEditor.publishRows()', function () {
                var that = this;
                this.iterator('row', function (context, index) {
                    this.cell(index, this.settings()[0]._tableEditor.s.statusIdx).data(2);
                });
                return this;
            });

            Api.register('TableEditor.unpublishRows()', function () {
                this.iterator('row', function (context, index) {
                    this.cell(index, this.settings()[0]._tableEditor.s.statusIdx).data(1);
                });
                return this;
            });
        }

        // 事件监听接口 - 操作的入口，点击触发 `inline` 编辑
        $(document).on('click', 'table.dataTable tr:gt(0) td:not(:has("input"))', function (e) {
            var $table = $(this).closest('table'),
                dtSettings = $table.DataTable().settings()[0];

            if ($.fn.DataTable.isDataTable($table) && dtSettings._tableEditor) {
                var $cell = $(this),
                    $row = $cell.closest('tr');

                if ($table.attr('data-action-edit')) {
                    dtSettings._tableEditor._callUserDefinedEditHandler($cell, $row, $table);
                } else {
                    dtSettings._tableEditor._callDefaultEditHandler($cell, $row, $table);
                }
            }
        });

        // 给文档添加接口，监听 `DataTables` 的初始化事件，以便自动初始化
        $(document).on('init.dt.dtr', function (e, settings, json) {

            /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
             * 有以下情况之一就会初始化 `TableEditor`，例如：
             *
             *     $('#example').DataTable( {
             *         ...
             *         editable: true,
             *         editor: {
             *             fields: {key: value}
             *         }
             * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

            if ($(settings.nTable).hasClass('editable') ||
                $(settings.nTable).hasClass('dt-editable') ||
                $(settings.nTable).attr('data-editable') == true ||
                settings.oInit.editable ||
                DataTable.defaults.editable
            ) {
                var opts = settings.oInit.editor || TableEditor.defaults; //针对 `TableEditor`的配置在'editor'选项这里，但基本未使用

                if (opts && !settings._tableEditor) {
                    new TableEditor(settings, $.isPlainObject(opts) ? opts : {});
                }
            }
        });

        return TableEditor;
    }; // /factory

    // 定义一个 `AMD` 模块
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'datatables'], factory);
    }
    else if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('jquery'), require('datatables'));
    }
    else if (jQuery && !jQuery.fn.dataTable.tableEditor) {
        // 仅作为普通jquery插件使用
        factory(jQuery, jQuery.fn.dataTable);
    }

})(window, document);
