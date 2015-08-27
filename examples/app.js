$(document).ready(function () {
    $('#example').DataTable({
        "ajax": "data.json",
        //serverSide: true,

        columns: [
            {
                "data": "name",
                "title": "Name",
                "editable": true,
                "defaultContent": ""
            },
            {
                "data": "position",
                "title": "Position",
                "editable": true,
                "type": "select", //默认使用select2.js
                "options": {
                    //width: 'element',
                    //height: '50px',
                    //tags: "true",
                    placeholder: "Select an option",
                    "data": [
                        {id: 'System Architect', text: 'System Architect'},
                        {id: 'Accountant', text: 'Accountant'}
                    ]
                },
                "defaultContent": "" //fixme 添加新行必须设置，否则提示错误
            },
            {
                "data": "salary",
                "title": "Salary",
                "editable": true,
                "defaultContent": ""
            },

            {
                "data": "start_date",
                "title": "Start Date",
                "class": "center",
                "editable": true,
                "type": "date",
                "options": {
                    format: 'yyyy/mm/dd',
                    startDate: '-3d'
                },
                "defaultContent": ""
            },

            {
                "data": "office",
                "title": "Office",
                "class": "center",
                "defaultContent": ""
            },
            {
                "data": "extn",
                "title": "Extension",
                "class": "center",
                "defaultContent": ""
            },
            {
                "data": "status",
                "visible": false,
                "searchable": false,
                "defaultContent": ""
            },
            {
                "data": "deleted",
                "width": "2em",
                "render": function (data, type, row, meta) {
                    if (row.status == 0 || row.status == null || row.status == "") {
                        return '<i class="icon-trash" data-action="delete">Trash</i>';
                    } else if (row.status == 1) {
                        return '<i class="icon-lock" data-action="unlock">Lock</i>';
                    } else {
                        return '';
                    }
                },
                "defaultContent": 0,
                "searchable": false,
                "sortable": false,
                "defaultContent": ""
            }
        ],

        editable: true,
        dirtyData: true,
        lockable: true,
        deletable: true,
        editUrl: "/"
    })
})
;
