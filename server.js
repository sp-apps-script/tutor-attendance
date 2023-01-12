// Config
const projectId = 'shareproyect'                         //Id del proyecto
const datasetId = 'vonex_tutors';                       //Nombre del conjunto de datos
const today = new Date();

//let userEmail = "jcuadros@vonex.edu.pe";
let userEmail = Session.getActiveUser().getEmail();

// Data
let writeDisposition = 'WRITE_APPEND';
let has_header = false;
let schema_bq = 'no_automatic';

// Get Registers Alumns
function getRegistersAlumns() {
  let request = {
    query: 'SELECT * ' +
      'FROM `shareproyect.vonex_tutors.alumns` ORDER BY last_name LIMIT 50;',
    useLegacySql: false
  };
  let queryResults = BigQuery.Jobs.query(request, projectId);

  if (queryResults.totalRows == 0) {
    let data = [];
    return data;
  } else {
    const jobId = queryResults.jobReference.jobId;
    let rows = queryResults.rows;
    while (queryResults.pageToken) {
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, {
        pageToken: queryResults.pageToken
      });
      rows = rows.concat(queryResults.rows);
    }

    // Append the headers.
    const headers = queryResults.schema.fields.map(function (field) {
      return field.name;
    });

    // Append the results.
    let data = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].f;
      data[i] = new Array(cols.length);
      for (let j = 0; j < cols.length; j++) {
        data[i][j] = cols[j].v;
      }
    }

    return data;
    //Logger.log(data);
  }
}

// Get Alumns Attendance
function getAlumnsAttendance(id_alumn, userEmail, fecha) {
  let request = {
    query: 'SELECT * ' +
      'FROM `shareproyect.vonex_tutors.alumn_attendance`' + 
      'WHERE id_alumn = '+ id_alumn +' AND tutor_email = "'+ userEmail +'" AND date = '+ fecha +
      'LIMIT 100;',
    useLegacySql: false
  };
  let queryResults = BigQuery.Jobs.query(request, projectId);

  if (queryResults.totalRows == 0) {
    let data = [];
    return 0;
  } else {
    const jobId = queryResults.jobReference.jobId;
    let rows = queryResults.rows;
    while (queryResults.pageToken) {
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, {
        pageToken: queryResults.pageToken
      });
      rows = rows.concat(queryResults.rows);
    }

    // Append the results.
    let data = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].f;
      data[i] = new Array(cols.length);
      for (let j = 0; j < cols.length; j++) {
        data[i][j] = cols[j].v;
      }
    }

    return data.length;
    //Logger.log(data);
  }
}

// GET
function doGet() {
  let htmlOutput = HtmlService.createTemplateFromFile('index');
  let registerAlumns = getRegistersAlumns();

  htmlOutput.registerAlumns = registerAlumns;
  return htmlOutput.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// POST
function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.tryLock(5000)


  try {
    let result;
    let register = [];

    // Conversations
    if (e.parameter.action == "conversations" || e.parameter.action == "calls") {
      let type;
      if(e.parameter.action == "conversations"){
        type = "conversations"
      }else if(e.parameter.action == "calls"){
        type = "calls"
      }

      let headerConversations = ["id_alumn", "tutor_email", "date", "time", "communicate", "absence", "observation", "type"];
      let tableId = 'tutor_help';

      // Add Row
      let newRow = headerConversations.map(function (column) {
        if (column === 'tutor_email') {
          return userEmail;
        } else if (column === 'date') {
          return getDate();
        } else if (column === 'time') {
          return getTime();
        } else if (column === 'type') {
          return type;
        }else {
          return e.parameter[column];
        }
      })
      let range = [[...newRow]];

      let schema_table = "form";

      result = "success";
      // Insert Row
      upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);

    }

    Utilities.sleep(2000)

    return ContentService
      .createTextOutput(JSON.stringify({ 'result': result, 'register': register  }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': e }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  finally {
    lock.releaseLock()
  }
}

function upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table) {
  if (typeof writeDisposition == "undefined") {
    writeDisposition = 'WRITE_EMPTY'
  }

  if (typeof has_header == "undefined" || has_header == true) {
    has_header = 1;
  } else {
    has_header = 0;
  }

  var data = [...range];
  let csvFile = undefined;

  if (data.length >= 1) {
    var csv = "";
    csvFile = csv;

    // Validate items
    for (var row = 0; row < data.length; row++) {
      for (var col = 0; col < data[row].length; col++) {
        if (data[row][col].toString().indexOf(",") != -1) {
          data[row][col] = "\"" + data[row][col] + "\"";
        }
      }

      // join each row's columns
      // add a carriage return to end of each row, except for the last one
      if (row < data.length - 1) {
        csv += data[row].join(",") + "\r\n";
      } else {
        csv += data[row];
      }
    }
    csvFile = csv;
  }

  // return csvFile;
  var csv_name = 'temp_' + new Date().getTime() + '.csv'
  DriveApp.createFile(csv_name, csvFile)

  var files = DriveApp.getFilesByName(csv_name);
  while (files.hasNext()) {
    var file = files.next();

    var table = {
      tableReference: {
        projectId: projectId,
        datasetId: datasetId,
        tableId: tableId
      },
    };

    // Create a new table if it doesn't exist yet.
    try {
      table = BigQuery.Tables.get(projectId, datasetId, tableId)
      Logger.log('BD exists');
    }
    catch (error) {
      table = BigQuery.Tables.insert(table, projectId, datasetId);
      Logger.log('BD created: %s', table.id);
    }

    var data = file.getBlob().setContentType('application/octet-stream');

    if (typeof schema_bq == "undefined" || schema_bq == false || schema_bq == 'automatic') {
      // Create the data upload job.
      var job = {
        configuration: {
          load: {
            destinationTable: {
              projectId: projectId,
              datasetId: datasetId,
              tableId: tableId
            },
            skipLeadingRows: has_header,
            autodetect: true,
            writeDisposition: writeDisposition
          }
        }
      };
    } else { 

     if(schema_table == "form"){
      // Insert the data upload job.
      var job = {
        configuration: {
          load: {
            destinationTable: {
              projectId: projectId,
              datasetId: datasetId,
              tableId: tableId
            },
            skipLeadingRows: has_header,

            // Enter a schema below:
            schema: {
              fields: [
                { name: 'id_alumn', type: 'INTEGER' },
                { name: 'tutor_email', type: 'STRING' },
                { name: 'date', type: 'DATE' },
                { name: 'time', type: 'TIME' },
                { name: 'communicate', type: 'STRING' },
                { name: 'absence', type: 'STRING' },
                { name: 'observation', type: 'STRING' },
                { name: 'type', type: 'STRING' },                
              ]
            },
            writeDisposition: writeDisposition
          }
        }
      };
     }else{
        // Insert the data upload job.
        var job = {
          configuration: {
            load: {
              destinationTable: {
                projectId: projectId,
                datasetId: datasetId,
                tableId: tableId
              },
              skipLeadingRows: has_header,

              // Enter a schema below:
              schema: {
                fields: [
                  { name: 'id_alumn', type: 'INTEGER' },
                  { name: 'tutor_email', type: 'STRING' },
                  { name: 'week', type: 'INTEGER' },
                  { name: 'day', type: 'INTEGER' },
                  { name: 'state', type: 'STRING' },
                  { name: 'date', type: 'DATE' },
                  { name: 'time', type: 'TIME' },
                  
                ]
              },
              writeDisposition: writeDisposition
            }
          }
        };
     }

    }
    job = BigQuery.Jobs.insert(job, projectId, data);
    //file.setTrashed(true);
  }

  // Log
  Logger.log("Records were uploaded")
}

// FORMS
function sendform(alumn,communicate,absence,observation,formAction){
  let type;
  if(formAction == "conversations"){
    type = "conversaciones"
  }else if(formAction == "calls"){
    type = "llamadas"
  }

  let headerConversations = ["id_alumn", "tutor_email", "date", "time", "communicate", "absence", "observation", "type"];
  let tableId = 'tutor_help';

  // Add Row
  let newRow = headerConversations.map(function (column) {
    if (column === 'id_alumn') {
      return alumn;
    } else if(column === 'tutor_email') {
      return userEmail;
    } else if (column === 'date') {
      return getDate();
    } else if (column === 'time') {
      return getTime();
    } else if (column === 'communicate') {
      return communicate;
    } else if (column === 'absence') {
      return absence;
    } else if (column === 'observation') {
      return observation;
    } else if (column === 'type') {
      return type;
    }
  })
  let range = [[...newRow]];
  let schema_table = "form";

  // Insert Row
  upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);
  Utilities.sleep(2000)
  return "ok";
}

// ATTENDANCE QR
function sendback(x,y,w) {
  let dni= x.substr(-8);
  let headerAttendance = ["id_alumn", "tutor_email", "week", "day", "state", "date", "time"];
  let tableId = 'alumn_attendance';

  let cantAttendance = getAlumnsAttendance(dni, userEmail, getDate());

  if (cantAttendance == 0){
    // Add Row
    let newRow = headerAttendance.map(function (column) {
      if (column === 'id_alumn') {
        return dni;
      } else if(column === 'tutor_email') {
        return userEmail;
      } else if (column === 'week') {
        return w;
      } else if (column === 'day') {
        return getDay();
      } else if (column === 'state') {
        return y;
      } else if (column === 'date') {
        return getDate();
      } else if (column === 'time') {
        return getTime();
      }
    });
    let range = [[...newRow]];
    let schema_table = "attendance";

    // Insert Row
    upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);

    //Utilities.sleep(2000)
    return "ok";
  } else {
    return "no";
  }
}

// ATTENDANCE CHECKBOX
function receiveAttendance(type,week,alumns) {
  let headerAttendance = ["id_alumn", "tutor_email", "week", "day", "state", "date", "time"];
  let tableId = 'alumn_attendance';
  //let cantAttendance = getAlumnsAttendance(dni, userEmail, getDate());

  let newRow = [];
  let range = [];
  alumns.forEach((value,i) => {
    newRow.push(value,userEmail,week,getDay(),type,getDate(),getTime())
    range.push(newRow);
    newRow = [];
  })

  let schema_table = "attendance";

  // Insert Row
  upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);

  //Utilities.sleep(2000)
  return range;
}

// Get Week
function getWeek(){
  //let currentdate = new Date();
  let oneJan = new Date(today.getFullYear(),0,1);
  let numberOfDays = Math.floor((today - oneJan) / (24 * 60 * 60 * 1000));
  let week = Math.ceil(( today.getDay() + 1 + numberOfDays) / 7);
  return week;
}

// Get Day
function getDay(){
  let day = today.getDay();
  return day;
}

// Get Date
function getDate(){
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  let day = today.getDate();
  let date = `"${year}-${month}-${day}"`;
  return date;
}

// Get Time
function getTime(){
  let hour = today.getHours();
  let minute = today.getMinutes();
  let seconds = today.getSeconds();
  let time = `"${hour}:${minute}:${seconds}"`;
  return time;
}

function testing(){
  let dni = 75242814;
  Logger.log(getAlumnsAttendance(dni, userEmail, getDate()));
}

function sendTest(a,b){
  return a+b;
}
