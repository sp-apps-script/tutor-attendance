// Config
const projectId = 'bigqueryvonex'                         //Id del proyecto
const datasetId = 'academy';                              //Nombre del conjunto de datos

// Data
let writeDisposition = 'WRITE_APPEND';
let has_header = false;
let schema_bq = 'no_automatic';
let today = new Date();
let userEmail = Session.getActiveUser().getEmail();
//let userEmail = "dherrera@vonex.edu.pe";

let listSede = ["LIMA CENTRO","SJL","LIMA NORTE","HCO - DOS DE MAYO","HCO - CRESPO Y CASTILLO"];
let listModality = ["PRESENCIAL","VIRTUAL"];
let listClassroom = ["A","B"];

// DOGET
function doGet() {
  let htmlOutput = HtmlService.createTemplateFromFile('index');
  //let alumns = getAlumns();
  let tutor = getTutorByEmail();
  let show = true;
  if(tutor.length == 0){
    show = false;
  }

  //htmlOutput.apiAlumns = alumns;
  htmlOutput.show = show;
  htmlOutput.apiTutor = tutor;
  htmlOutput.email = userEmail;
  return htmlOutput.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// DATA FORMS
function sendform(alumn,communicate,absence,observation,formAction,cycle){
  let type;
  if(formAction == "conversations"){
    type = "conversaciones"
  }else if(formAction == "calls"){
    type = "llamadas"
  }

  let headerConversations = ["id_alumn", "tutor_email", "date", "time", "communicate", "absence", "observation", "type", "cycle"];
  let tableId = 'alumn_form';

  // Add Row
  let newRow = headerConversations.map(function (column) {
    if (column === 'id_alumn') {
      return alumn;
    } else if(column === 'tutor_email') {
      return userEmail;
    } else if (column === 'date') {
      return getDate_();
    } else if (column === 'time') {
      return getTime_();
    } else if (column === 'communicate') {
      return communicate;
    } else if (column === 'absence') {
      return absence;
    } else if (column === 'observation') {
      return observation;
    } else if (column === 'type') {
      return type;
    } else if (column === 'cycle') {
      return cycle;
    }
      
  })
  let range = [[...newRow]];
  let schema_table = "form";

  // Insert Row
  upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);
  Utilities.sleep(2000)
  return "ok";
}

// DATA ATTENDANCE QR / DNI
function senddataone(dni,state,week,cycle,mode) {
  let headerAttendance = ["id_alumn", "tutor_email", "week", "day", "state", "date", "time","cycle"];
  let tableId = 'alumn_attendance';

  let alumnValid = getAlumnsByTutorDni(userEmail,cycle,dni);

  if(alumnValid.length == 0){
    return "no_exist"
  }else{
    let cantAttendance = getAlumnsAttendanceByDate(dni, userEmail, getDate_());
    if (cantAttendance == 0){
      // Add Row
      let newRow = headerAttendance.map(function (column) {
        if (column === 'id_alumn') {
          return dni;
        } else if(column === 'tutor_email') {
          return userEmail;
        } else if (column === 'week') {
          return week;
        } else if (column === 'day') {
          return getDay_();
        } else if (column === 'state') {
          return state;
        } else if (column === 'date') {
          return getDate_();
        } else if (column === 'time') {
          return getTime_();
        } else if (column === 'cycle') {
          return cycle;
        }
      });
      let range = [[...newRow]];
      let schema_table = "attendance";

      // Insert Row
      upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);

      return "ok";
    } else {
      return "no";
    }
  }
}

// DATA ATTENDANCE CHECKBOX / FILE
function senddataall(data,type,week,cycle) {
  let headerAttendance = ["id_alumn", "tutor_email", "week", "day", "state", "date", "time","cycle"];
  let tableId = 'alumn_attendance';
  
  //let alumnValid = getAlumnsByTutorDni(userEmail,cycle,data[0]);
  let cantAttendace = getAlumnsByCycleTable(cycle, userEmail, getDate_(), tableId, week);
  
  let newRow = [];
  let range = [];
  data.forEach((value,i) => {
    let attendance = "";
    let dni;

    if(type == "check"){
      let newValue = value.split(',');
      if(newValue[1] != "F"){
        attendance = newValue[1]
      }
      dni = newValue[0];
    }else{
      attendance = type;
      dni = value;
    }

    newRow.push(dni,userEmail,week,getDay_(),attendance,getDate_(),getTime_(),cycle)
    range.push(newRow);
    newRow = [];
  })

  let schema_table = "attendance";

  // Insert Row
  upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);

  return range;
}

// DATA GOAL
function senddatagoal(data,week,cycle) {
  let headerAttendance = ["id_alumn", "tutor_email", "date", "time", "week", "goal","cycle"];
  let tableId = 'alumn_goal';

  let cantAttendace = getAlumnsByCycleTable(cycle, userEmail, getDate_(),tableId,week);
  
  let newRow = [];
  let range = [];
  data.forEach((value,i) => {
    let attendance = "";

    let newValue = value.split(',');
    let dni = newValue[0];
    let goal = newValue[1];

    newRow.push(dni,userEmail,getDate_(),getTime_(),week,goal,cycle)
    range.push(newRow);
    newRow = [];
  })

  let schema_table = "goal";

  // Insert Row
  upload_to_BigQ_(range, projectId, datasetId, tableId, writeDisposition, has_header, schema_bq, schema_table);

  return range;
}


// Get Alumns by Cycle
function getAlumnsByCycle(tutor,cycle){
  let msgAttendance;
  let msgGoal;
  let header = [];

  let attendanceToday = getAlumnsByTutorAttendance(tutor,cycle,getDate_());
  let weekGoal = getAlumnsByTutorGoal(tutor,cycle);
  let alumns = getAlumnsByTutor(tutor,cycle);

  alumns.forEach((item) =>{
    header.push(item[0])
  })
  // Attendance
  if (attendanceToday.length >= 1){
    for (value of alumns) {
      let dni = value[0]

      for (item of attendanceToday) {
        if(item[0] == dni){
          value[3] = item[3];
          value[4] = item[4];
        }
      }
      if(header.includes(dni)){
      }
    }
    msgAttendance = "attendance_true";
  } else{
    msgAttendance = "attendance_false";
  }

  // Goal
  if (weekGoal.length >= 1){
    for (value of alumns) {
      let dni = value[0]

      for (item of weekGoal) {
        if(item[0] == dni){
          value[5] = item[3];
          value[6] = item[4];
        }
      }
      if(header.includes(dni)){
      }
    }
    msgGoal = "goal_true";
  } else{
    //dataGoal = [...alumns];
    msgGoal = "goal_false";
  }
  
  let newData = [alumns,msgAttendance,msgGoal]
  return newData;
}
// Get Tutor by Email
function getTutorByEmail() {
  let tableId = "alumn";
  let request = {
    query: 'SELECT DISTINCT email_tutor,apellido_tutor,nombre_tutor,codigo_final, ' +
      'FROM '+ projectId + '.' + datasetId +'.'+ tableId + 
      ' WHERE email_tutor IS NOT NULL AND email_tutor = "'+ userEmail +'";',
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
// Get Alumns
function getAlumns() {
  let tableId = "alumn";
  let request = {
    query: 'SELECT * ' +
      'FROM '+ projectId + '.' + datasetId +'.'+ tableId + ' LIMIT 50;',
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
// Get Alumns by Tutor
function getAlumnsByTutor(tutor,cycle) {
  let tableId = "alumn";
  let request = {
    query: 'SELECT DISTINCT dni_alumno,apellido_alumno,nombre_alumno,concat("") as state, concat("") as weeka,concat("") as goal, concat("") as weekg ' +
      'FROM '+ projectId + '.' + datasetId +'.'+ tableId + 
      ' WHERE email_tutor = "'+ tutor +'" AND codigo_final = "'+ cycle +'"'+
      'ORDER BY apellido_alumno;',
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
// Get Alumns by Tutor & Attendance
function getAlumnsByTutorAttendance(tutor,cycle,date) {
  let tableId = "alumn_attendance";
  let tableInner = "alumn";

  let request = {
    query: 'SELECT DISTINCT dni_alumno,apellido_alumno,nombre_alumno,state,week ' +
      'FROM '+ projectId + '.' + datasetId +'.'+ tableId + ' tatt ' + 
      'INNER JOIN ' + projectId + '.' + datasetId +'.'+ tableInner + ' talu' +
      ' ON talu.dni_alumno = tatt.id_alumn' +
      ' WHERE email_tutor = "'+ tutor +'" AND codigo_final = "'+ cycle +'" AND date = '+ date +' '+
      'ORDER BY apellido_alumno;',
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
// Get Alumns by Tutor & Goal
function getAlumnsByTutorGoal(tutor,cycle) {
  let tableId = "alumn_goal";
  let tableInner = "alumn";

  let request = {
    query: 'SELECT DISTINCT dni_alumno,apellido_alumno,nombre_alumno,goal,week ' +
      'FROM '+ projectId + '.' + datasetId +'.'+ tableId + ' tgoa ' + 
      'INNER JOIN ' + projectId + '.' + datasetId +'.'+ tableInner + ' talu' +
      ' ON talu.dni_alumno = tgoa.id_alumn' +
      ' WHERE email_tutor = "'+ tutor +'" AND codigo_final = "'+ cycle +'" '+
      ' AND week = (SELECT week FROM '+ projectId + '.' + datasetId +'.'+ tableId + ' WHERE tutor_email = "'+ tutor +'" AND cycle = "'+ cycle +'" ORDER BY week DESC LIMIT 1 ) '+
      'ORDER BY week DESC;',
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
// Get Alumns Attendance by date
function getAlumnsAttendanceByDate(id_alumn, userEmail, date) {
  let tableId = "alumn_attendance";
  let request = {
    query: 'SELECT * ' +
      'FROM '+ projectId +'.'+datasetId +'.'+ tableId + ' ' +
      'WHERE id_alumn = "' + id_alumn + '" AND tutor_email = "'+ userEmail +'" AND date = '+ date +
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
// Get Alumn by Tutor & DNI
function getAlumnsByTutorDni(tutor, cycle, dni) {
  let tableId = "alumn";

  let request = {
    query: 'SELECT DISTINCT dni_alumno,apellido_alumno,nombre_alumno ' +
      'FROM '+ projectId + '.' + datasetId +'.'+ tableId + 
      ' WHERE email_tutor = "'+ tutor +'" AND codigo_final = "'+ cycle +'" AND dni_alumno = "'+ dni +'"'+
      'ORDER BY apellido_alumno;',
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
// Get Alumns by Cycle
function getAlumnsByCycleTable(cycle, email, date, tableId, week){
  let request = {
    query: 'SELECT * ' +
      'FROM '+ projectId +'.'+datasetId +'.'+ tableId + ' ' +
      ' WHERE cycle = "' + cycle + '" AND tutor_email = "'+ email +'" AND date = '+ date +
      'LIMIT 1000;',
    useLegacySql: false
  };
  let queryResults = BigQuery.Jobs.query(request, projectId);

  if (queryResults.totalRows == 0) {
    let data = [];
    return data.length;
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

    deleteAlumnsByCycleTable(cycle,email,date,tableId,week)

    return data.length;
    //Logger.log(data.length);
  }
}
// Delete Alumns Attendance
function deleteAlumnsAttendance() {
  let tableId = "alumn_attendance";
  let request = {
    query: 'DELETE ' +
      'FROM '+ projectId + '.' + datasetId +'.'+ tableId + ' WHERE week > 0;',
    useLegacySql: false
  };
  let queryResults = BigQuery.Jobs.query(request, projectId);
  //Logger.log(queryResults.totalRow);
  return "ready";
}
// Delete Alumns Attendance by Cycle
function deleteAlumnsByCycleTable(cycle,email,date,tableId,week) {
  //let tableId = "alumn_attendance";

  if(tableId == "alumn_attendance"){
    let request = {
      query: 'DELETE ' +
        'FROM '+ projectId + '.' + datasetId +'.'+ tableId + 
        ' WHERE cycle = "' + cycle + '" AND tutor_email = "'+ email +'" AND date = '+ date + ' ;',
      useLegacySql: false
    };
    let queryResults = BigQuery.Jobs.query(request, projectId);
  }else{
    let request = {
      query: 'DELETE ' +
        'FROM '+ projectId + '.' + datasetId +'.'+ tableId + 
        ' WHERE cycle = "' + cycle + '" AND tutor_email = "'+ email +'" AND week = '+ week + ' ;',
      useLegacySql: false
    };
    let queryResults = BigQuery.Jobs.query(request, projectId);
  }
}


// Merge Cycle Complete
function mergeCycle_(tutor) {
  //let tutor = getTutorByEmail();
  let cycleComplete = [];

  tutor.forEach((value,i) =>{
    let cycle = value[3];
    let modality = value[4];
    let building = value[5];
    let classroom = value[6];
    
    let newModality = createModality_(modality);
    let newBuilding = createBuilding_(building);
    let newClassroom = createClassroom_(classroom);
    let newCycle = cycle + newModality + newBuilding + newClassroom;

    cycleComplete.push([value[0],value[1],value[2],value[3],value[4],value[5],value[6],newCycle]);
  })
  
  //Logger.log(cycleComplete)
  return cycleComplete;
}
// Create Modality Short
function createModality_(modality){
  let modalityShort;
  switch (modality) {
    case "PRESENCIAL":
      modalityShort = "P";
      break;
    case "VIRTUAL":
      modalityShort =  "V";
      break;
    default:
      modalityShort =  "X";
    break;
  }
  return modalityShort
}
// Create Building Short
function createBuilding_(building){
  let buildingShort;
  switch (building) {
    case "LIMA CENTRO":
      buildingShort = "1";
      break;
    case "SJL":
      buildingShort =  "2";
      break;
    case "LIMA NORTE":
      buildingShort =  "3";
      break;
    case "HCO - DOS DE MAYO":
      buildingShort =  "4";
      break;
    case "HCO - CRESPO Y CASTILLO":
      buildingShort =  "5";
      break;
    default:
      buildingShort =  "X";
    break;
  }
  return buildingShort
}
// Create Classroom Short
function createClassroom_(classroom){
  let classroomShort;
  switch (classroom) {
    case "A":
      classroomShort = "A";
      break;
    case "B":
      classroomShort =  "B";
      break;
    default:
      classroomShort =  "X";
    break;
  }
  return classroomShort
}


// Upload Bigquery
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
                { name: 'id_alumn', type: 'STRING' },
                { name: 'tutor_email', type: 'STRING' },
                { name: 'date', type: 'DATE' },
                { name: 'time', type: 'TIME' },
                { name: 'communicate', type: 'STRING' },
                { name: 'absence', type: 'STRING' },
                { name: 'observation', type: 'STRING' },
                { name: 'type', type: 'STRING' },
                { name: 'cycle', type: 'STRING' },
              ]
            },
            writeDisposition: writeDisposition
          }
        }
      };
      }else if(schema_table == "goal"){
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
                  { name: 'id_alumn', type: 'STRING' },
                  { name: 'tutor_email', type: 'STRING' },
                  { name: 'date', type: 'DATE' },
                  { name: 'time', type: 'TIME' },
                  { name: 'week', type: 'INTEGER' },
                  { name: 'goal', type: 'STRING' },
                  { name: 'cycle', type: 'STRING' },
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
                  { name: 'id_alumn', type: 'STRING' },
                  { name: 'tutor_email', type: 'STRING' },
                  { name: 'week', type: 'INTEGER' },
                  { name: 'day', type: 'INTEGER' },
                  { name: 'state', type: 'STRING' },
                  { name: 'date', type: 'DATE' },
                  { name: 'time', type: 'TIME' },
                  { name: 'cycle', type: 'STRING' },
                ]
              },
              writeDisposition: writeDisposition
            }
          }
        };
      }

    }
    job = BigQuery.Jobs.insert(job, projectId, data);
    file.setTrashed(true);
  }

  // Log
  Logger.log("Records were uploaded")
}


// Get Date
function getDate_(){
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  let day = today.getDate();
  let date = `"${year}-${month}-${day}"`;
  return date;
}
// Get Week
function getWeek_(){
  //let currentdate = new Date();
  let oneJan = new Date(today.getFullYear(),0,1);
  let numberOfDays = Math.floor((today - oneJan) / (24 * 60 * 60 * 1000));
  let week = Math.ceil(( today.getDay() + 1 + numberOfDays) / 7);
  return week;
}
// Get Day
function getDay_(){
  let day = today.getDay();
  return day;
}
// Get Time
function getTime_(){
  let hour = today.getHours();
  let minute = today.getMinutes();
  let seconds = today.getSeconds();
  let time = `"${hour}:${minute}:${seconds}"`;
  return time;
}


// Testing
function testing(){
  //deleteAlumnsAttendanceByCycle("SMREV0123","jcuadros@vonex.edu.pe",'2023-01-18')
  let tutor = "jcuadros@vonex.edu.pe";
  let cycle = "HVVEG0123P5A";

  Logger.log(getAlumnsByCycle(userEmail,cycle))
}
