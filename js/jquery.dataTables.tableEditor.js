
/**
 * @project DataTables Editor
 * @maintainer MoJie
 * @version 0.0.6
 * @contributor MoJie
 * @file jquery.dataTables.tableeditor.js
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
var factory = function( $, DataTable ) {

/**
 * Editor adds the ability to edit datatable cell data by adding inputs to allowed
 * cells when clicking on a row within the table. It allows the user to easily edit
 * the table data source.
 *
 * Editor can be initialsed in a number of ways.
 * Add editable: true to the table settings object or default datatable settings object.
 * @example
 *      $('#example').dataTable( {
 *          "editable": true,
 *      } );
 *
 * Add the class 'editable' or 'dt-editable' to the tables html
 * @example
 *      <table id="example" class="display editable" cellspacing="0" width="100%"></table>
 *
 * Add the data attribute 'data-editable = true' to the tables html
 * @example
 *      <table id="example" class="display" data-editable="true" cellspacing="0" width="100%"></table>
 *
 *  @class
 *  @constructor
 *  @global
 *  @param {object} dt DataTables settings object
 *  @param {object} [init={}] Configuration object for Editable. Options
 *    are defined by {@link Editable.defaults}
 *
 *  @requires jQuery 1.7+
 *  @requires DataTables 1.10.7+
 */
var Editor = function(dt, init) {
    var that = this;

    // Sanity check
    // Check that we are using DataTables 1.10.7 or newer
    if ( ! DataTable.versionCheck || ! DataTable.versionCheck( '1.10.7' ) )
    {
        throw 'DataTables Editor requires DataTables 1.10.7 or newer';
    }

    // Check if Editable has already been initialised on this table
    if ( dt.editable )
    {
        return;
    }

    // If settings weren't passed in define them just to be safe
    if ( typeof init == 'undefined' )
    {
        init = {};
    }

    // Use the DataTables Hungarian notation mapping method, if it exists to
    // provide forwards compatibility for camel case variables
    if ($.fn.DataTable.camelToHungarian) {
        $.fn.DataTable.camelToHungarian(Editor.defaults, init);
    }

    // v1.10 allows the settings object to be got form a number of sources
    var dtSettings = $.fn.DataTable.Api ? new $.fn.DataTable.Api(dt).settings()[0] : dt.settings();

    // Attach the instance to the DataTables instance so it can be accessed easily
    dtSettings._Editor = this;

    this.s = {
        dt: new $.fn.DataTable.Api(dt)
    };

    // Find the deleted and status columns so we can save the indexes for later use
    $.each(dtSettings.aoColumns, function(index, settings) {
        if (settings.mData == "deleted" || settings.data == "deleted" || settings.name == "deleted") {
            that.s.deletedIdx = settings.idx;
        }
        if (settings.mData == "status" || settings.data == "status" || settings.name == "status") {
            that.s.statusIdx = settings.idx;
        }
    });

    // Build it
    if ( ! dtSettings._bInitComplete )
    {
        dtSettings.oApi._fnCallbackReg(dtSettings, 'aoInitComplete', function() {
            that._construct(init);
        });
    }
    else
    {
        this._construct(init);
    }
}; // /Editor

Editor.prototype = {
    /**
     * Initialisation for Editor
     *  @returns {void}
     *  @private
     */
    _construct: function(init) {
        var that = this;

        // Save the clean form data to _startingValues
        this._dataSaved();

        // Set locked and published data attributes and classes where they need to be
        that._checkStatus();

        // Attach to draw event to check status when table changes
        $(this.s.dt.table().node()).on('draw.dt', function(e, settings) {
            that._checkStatus();
        });

        $(this.s.dt.table().node()).on('click', 'i[data-action="unlock"]', function(e) {
            e.stopPropagation();
            console.log('unlock');
        });

        $(this.s.dt.table().node()).on('save.dt.editable', function(e) {
            that._updateRowState($(that.s.dt.row(e.rowIndex)));
        });

        $(this.s.dt.table().node()).on('click', 'i[data-action="delete"]', function(e) {
            e.stopPropagation();
            that._deleteRow(that.s.dt.row($(this).closest('tr')));
        });

        $(document).on('click', '[data-action="addRow"]', function(e) {
            that._addRow();
        });

        $(document).on('click', function(e) {
            var $target = $(e.target),
                $table = $(that.s.dt.table().node()),
                $activeRow = $table.find('tr.editing'),
                $inputs,
                $form;

            // If we aren't editing a row return early
            if ($activeRow.length == 0) {
                return;
            }

            // If we are clicking on the element with data-action="addRow" return early
            if ($target.attr('data-action') === 'addRow') {
                return;
            }

            // If we are clicking on the row being edited or one of its descendants return early
            if ($target.hasClass('editing') || $target.closest('tr.editing').length > 0) {
                return;
            }

            $inputs = $activeRow.find('input');
            $form = $table.closest('form');

            // Find the active row and save it if it has inputs
            if ($inputs.filter(function() {return $(this).val()}).length == 0) {
                $activeRow.remove();
                return;
            }

            if ($inputs.length > 0 && ($form.length === 0 || $form.valid())) {
                that._callSaveHandler(that.s.dt, $activeRow);
            }
        });

        $(document).on('keypress', function(e) {
            var key = e.which;
            if (key === 13) {
                var $inputs = $('table.dataTable tr.editing input'),
                $row = $inputs.closest('tr'),
                $table = $row.closest('table'),
                $form = $table.closest('form'),
                dt = $table.DataTable();

                if ($inputs.filter(function() {return $(this).val()}).length == 0) {
                    $row.remove();
                    return;
                }

                if ($table.find('tr.editing').length > 0 && $inputs.length > 0 && ($form.length === 0 || $form.valid())) {
                    dt.settings()[0]._Editor._callSaveHandler(dt, $row);
                }
            }
        });
    },
    _checkStatus: function(rows) {
        var that = this;

        // If rows is undefined set it to the current page rows with filter applied.
        if (typeof rows == 'undefined') {
            rows = this.s.dt.rows({"page":"current", "filter":"applied"});
        }

        rows.iterator('row', function(context, index) {
            // Make sure status property exists
            var row = this.row(index),
                status = row.data().status;
            if (status == 0) {
                that._unlockRow(row);
                that._unpublishRow(row);
            }
            if (status == 1) {
                that._lockRow(row);
            }
            if (status == 2) {
                that._publishRow(row);
            }
        });
    },
    _lockRow: function(row) {
        $(row.node()).addClass('locked').attr('data-locked', true).attr('data-editable', false);
    },
    _unlockRow: function(row) {
        $(row.node()).removeClass('locked').attr('data-locked', false).attr('data-editable', true);

    },
    _publishRow: function(row) {
        $(row.node()).addClass('published').attr('data-published', true);
    },
    _unpublishRow: function(row) {
        $(row.node()).removeClass('published').attr('data-published', false);
    },
    _dataSaved: function() {
        $.extend(true, this._startingValues, this.s.dt.data().toArray());
    },
    _rollbackData: function() {
        var dt = this.s.dt;
        dt.rows().remove();
        $.each(this._startingValues, function(key, value) {
            dt.row.add(value);
        });

        this._dirtyValues = {};
        dt.draw();
    },
    _updateRowState: function($row) {
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
    _deleteRow: function(row) {
        var data = row.data(),
            dt = this.s.dt;

        // Return early if locked or published
        if (data.status == 1 || data.status == 2) {
            return this;
        }

        if (data.status === 0) {
            dt.cell(row.index(), this.s.deletedIdx).data(1);

            // Trigger a save event that users can hook into and pass all data in it
            $(dt.table().node()).trigger({
                type: 'save.dt.editable',
                rowIndex: row.index(),
                rowData: row.data()
            });
        }

        // If the row was added and not loaded from data src then clear it from dirtyData
        if (data.status === 'undefined' || data.status === null) {
            delete this._dirtyValues[row.index()];
        }

        row.remove().draw();

        return this;
    },
    /**
     *  Get the data currently contained in the inputs of the row currently
     *  being edited and save the values to the datatable data source. Change
     *  the edited cells back to a normal datatable cell without inputs.
     *  @event save.dataTableEditor Triggers and passes the row index and the
     *      new row data.
     *  @event click.dataTableEditor Removes event listener.
     *  @returns {void}
     *  @private
     */
    _callSaveHandler: function(dt, $row) {
        var $form = $row.closest('form'),
            $cells = $row.find('td'),
            rowData = {},
            rowIdx = 0,
            $table = $(dt.table().node());

        // Make sure there are inputs to save
        if ( $('input', $table).length < 1 )
        {
            return;
        }

        // Make sure the form is valid
        if ( $form.length == 0 || $form.valid() ) {

            if (dt.row($row).node() == null) {
                var aoColumns = dt.settings()[0].aoColumns,
                    visibleCount = 0,
                    $td = $row.find('td');
                $.each(aoColumns, function(key, value) {
                    var jsonValue = (value.bVisible) ? $td.eq(visibleCount).find('input').val() : null;
                    rowData[value.mData] = jsonValue;
                    visibleCount++;
                });

                var row = dt.row.add(rowData),
                    rowIdx = row.index();
            } else {
                    rowData = dt.row($row).data(),
                    rowIdx = dt.row($row).index();

                $cells.each( function() {
                    var cell = dt.cell(this),
                        $input = $(cell.node()).find('input'),
                        jsonProp = dt.settings()[0].aoColumns[dt.cell(this).index().column].mData,
                        jsonValue = ( $input.length != 0 ) ? $input.val() : cell.data();

                    rowData[jsonProp] = jsonValue;
                });

                dt.row($row).data(rowData);
            }

            dt.draw(false);

            // Trigger a save event that users can hook into and pass all data in it
            $(dt.table().node()).trigger({
                type: 'save.dt.editable',
                rowIndex: rowIdx,
                rowData: rowData
            });

            // Remove class 'editing' from the row
            $row.removeClass('editing');
        }
    },
    _isEditable: function(dt, $cell) {
        var cellIdx = dt.cell($cell).index().column;
        if ($cell.attr('data-editable') == "false" || $cell.closest('tr').attr('data-editable') == "false") {
            return false;
        }

        return dt.settings()[0].aoColumns[cellIdx].editable || $(dt.table().header()).find('th').eq(cellIdx).attr('data-editable') == "true";
    },
    _getRowTemplate: function($row, isNew) {
        var that = this,
            dt = this.s.dt;

        if (typeof isNew == 'undefined') {
            isNew = false;
        }

        // Get each td and convert it to a input based on the data-input-type attribute on the corresponding th
        $row.find('td').each(function(key, value) {
            var $cell = $(this),
                $th = $(dt.table().header()).find('th').eq(key);

            if ( isNew || that._isEditable(dt, $cell) ) {
                var template = ($th && $th.attr('data-template')) ? $($th.attr('data-template')) : $('<input type="text" class="span12" value="">'),
                    $html;

                if (template.is('input')) {
                    $html = template.val($cell.text());
                } else {
                    template.find('input').val($cell.text());
                    $html = template;
                }

                $cell.html($html);
            }
        });
    },
    _setFocus: function(dt, $row, $cell) {
        // Set focus to the clicked on cells input if it is editable
        // otherwise set focus to the first editable cell in the row
        if ( typeof $cell != 'undefined' && this._isEditable(dt, $cell) ) {
            $cell.find('input').focus();
        } else {
            $row.find('input').eq(0).focus();
        }
    },
    _callDefaultEditHandler: function($cell, $row, $table) {
        // If we are already editing one row then save it before we edit another
        var $inputs = $('input', $table),
            dt = $table.DataTable(),
            Editor = this;

        if ($inputs.length > 0 && ($inputs.closest('form').length == 0 || !$inputs.valid())) {
            return;
        }

        $row.trigger('click.dt.editable');

        // Get row template
        this._getRowTemplate($row);

        // Set class 'editing' to the row so we can find it easier
        $row.addClass('editing');

        this._setFocus(dt, $row, $cell);
    },
    _callUserDefinedEditHandler: function($cell, $row, $table) {
        var namespaces = $table.attr('data-action-edit').split('.'),
            editHandler = namespaces.pop();

        for ( var i = 0; i < namespaces.length; i++ )
        {
            context = window[namespaces[i]];
        }

        // Call the edit handler function
        context[editHandler].call(this, $row, $table);
    },
    _addRow: function() {
        var dt = this.s.dt,
            $table = $(dt.table().node()),
            $header = $(dt.table().header()),
            $row = $("<tr></tr>");

        // If there is already a row being edited then return early
        if ($('tr.editing', $table).length > 0) {
            return;
        }

        $header.find('th').each(function(key, value) {
            $row.append("<td></td>");
        });

        $row.addClass('editing');

        $table.find('tbody').prepend($row);
        this._getRowTemplate($row, true);
        this._setFocus(dt, $row);
    }
}; // /Editor.prototype
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Statics
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
Editor.defaults = {};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Constants
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
Editor.version = "0.0.6";

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Initialisation
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

// Attach Editor to DataTables so it can be accessed as an 'extra'
$.fn.DataTable.TableEditor = Editor;
$.fn.dataTable.tableEditor = Editor;

// DataTables 1.10 API method aliases
if ( $.fn.DataTable.Api )
{
    var Api = $.fn.DataTable.Api;

    Api.register('Editor()', function() {
        return this;
    });

    Api.register('Editor.addRow()', function() {
        this.settings()[0]._Editor._addRow();
        return this;
    });

    Api.register('Editor.getDirtyData()', function() {
        return this.settings()[0]._Editor._dirtyValues;
    });

    Api.register('Editor.dataSaved()', function() {
        this.settings()[0]._Editor._dataSaved();
        return this;
    });

    Api.register('Editor.rollbackData()', function() {
        this.settings()[0]._Editor._rollbackData();
        return this;
    });

    Api.register('Editor.updateRowState()', function($row) {
        this.settings()[0]._Editor._updateRowState($row);
        return this;
    });

    Api.register('Editor.lockRows()', function() {
        this.iterator('row', function(context, index) {
            this.cell(index, this.settings()[0]._Editor.s.statusIdx).data(1);
        });
        return this;
    });

    Api.register('Editor.unlockRows()', function() {
        this.iterator('row', function(context, index) {
            this.cell(index, this.settings()[0]._Editor.s.statusIdx).data(0);
        });
        return this;
    });

    Api.register('Editor.publishRows()', function() {
        var that = this;
        this.iterator('row', function(context, index) {
            this.cell(index, this.settings()[0]._Editor.s.statusIdx).data(2);
        });
        return this;
    });

    Api.register('Editor.unpublishRows()', function() {
        this.iterator('row', function(context, index) {
            this.cell(index, this.settings()[0]._Editor.s.statusIdx).data(1);
        });
        return this;
    });
}

// Attach event listeners
$(document).on('click', 'table.dataTable tr:gt(0) td:not(:has("input"))', function(e) {
    var $table = $(this).closest('table'),
        dtSettings = $table.DataTable().settings()[0];

    if ($.fn.DataTable.isDataTable( $table ) && dtSettings._Editor)
    {
        var $cell = $(this),
            $row = $cell.closest('tr');

        if ( $table.attr('data-action-edit') ) {
            dtSettings._Editor._callUserDefinedEditHandler($cell, $row, $table);
        } else {
            dtSettings._Editor._callDefaultEditHandler($cell, $row, $table);
        }
    }
});

// Attach a listener to the document which listens for DataTables initialisation
// events so we can automatically initialise
$(document).on( 'init.dt.dtr', function (e, settings, json) {
    if ( $(settings.nTable).hasClass( 'editable' ) ||
         $(settings.nTable).hasClass( 'dt-editable' ) ||
         $(settings.nTable).attr( 'data-editable' ) == true ||
         settings.oInit.editable ||
         DataTable.defaults.editable
    ) {
        var init = settings.oInit.Editor;

        if ( init !== false ) {
            new Editor( settings, $.isPlainObject( init ) ? init : {}  );
        }
    }
});

return Editor;
}; // /factory

// Define as an AMD module if possible
if ( typeof define === 'function' && define.amd ) {
    define( ['jquery', 'datatables'], factory );
}
else if ( typeof exports === 'object' ) {
    // Node/CommonJS
    factory( require('jquery'), require('datatables') );
}
else if ( jQuery && !jQuery.fn.dataTable.tableEditor ) {
    // Otherwise simply initialise as normal, stopping multiple evaluation
    factory( jQuery, jQuery.fn.dataTable );
}

})(window, document);
