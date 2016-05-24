
var http = require('http');
var express = require('express'),
    app = module.exports.app = express();
var morgan = require('morgan'); // Charge le middleware de logging
var server = http.createServer(app);
var io = require('socket.io').listen(server);  //pass a http.Server instance
var fs = require("fs");
server.listen(8080);
//server.listen(80);

app.use(morgan('dev')) // Active le middleware de logging
    .use(express.static(__dirname + '/static')) // Indique que le dossier /static contient des fichiers statiques (middleware chargé de base)
//    .use(favicon(__dirname + '/public/favicon.ico')) // Active la favicon indiquée


app.get('/download/:file', function(req, res){
  var file = __dirname + '/download/'+req.params.file;
  res.download(file); // Set disposition and send it.
  setTimeout(function(){fs.unlink(file)}, 3000);
});
//recupere les routes
app.get('/old', function(req, res) {
        res.setHeader('Content-Type', 'text/html');
        res.render('index.ejs',  {});
      });
      app.get('/', function(req, res) {
              res.setHeader('Content-Type', 'text/html');
              res.render('main.ejs',  {});
              });

app.use(function(req, res, next){
        res.setHeader('Content-Type', 'text/plain');
        res.status(404).send('Page introuvable !');
        });


io.on('connection', function (socket) {
  //new connection
  console.log("new web connection");
  io.sockets.emit("newData", [[1,1],[2040,1]]);

  //we need to load old figures previously saved
  fs.readdir("save", function(err, data){
    if (err) throw err;
    for(var i=0; i<data.length; i++){
      (function(_i){
      fs.readFile("save/"+data[_i], function(err, file){
        if(err) throw err;
        //if we have a txt file
        if(data[_i].indexOf(".txt")!=-1)
        {
          console.log(data[_i] + "-> fichier text");
          var myPixels=[];
          var myLines=file.toString().split("\r\n");
          for(var i=0; i<myLines.length; i++){
            var column=myLines[i].split(";");
            myPixels.push([column[0], column[1]]);
          }
          socket.emit("files", {name:data[_i], data:myPixels})
        }
        else{
        console.log(data[_i] + "-> fichier JSON");
        socket.emit("files", {name:data[_i], data:JSON.parse(file.toString())})
        }
      });})(i);
    }
  });

  socket.on("newAcquisition", function(value){
    newAcquisition(value);
  });
  socket.on("stop", function(){
    console.log("stop");
    serial_chipkit.write("<d>s;</d>");
  });

  socket.on("delete", function(data){
    //data is the name of our file
    fs.unlink("save/"+data);
  });

  socket.on("download", function(data){
    fs.readFile("save/"+data, function(err, file){
      if(err) throw err;
      var datas=JSON.parse(file.toString());
      var content="";
      for(var i=0; i<datas.length; i++){
        content+=datas[i][0]+";"+datas[i][1]+"\r\n";
      }
      var fileName="download/"+data+"-"+Math.floor(Math.random()*1000)+".txt";
      fs.writeFile(fileName,content, function(err){
        if(err) throw err;
        socket.emit("download_ok", fileName);
      });
    });
  })

  socket.on("save", function(data){
    console.log("save");
    var d=new Date();
    var mois=d.getMonth();
    var date=d.getDate();
    var heure=d.getHours();
    var minute=d.getMinutes();
    var seconde=d.getSeconds();
    if(d.getMonth()<10){
      mois="0"+d.getMonth();
    }
    if(d.getDate()<10){
      date="0"+d.getDate();
    }
    if(d.getHours()<10)
    {
      heure="0"+d.getHours();
    }
    if(d.getMinutes()<10)
    {
      minute="0"+d.getMinutes();
    }
    if(d.getSeconds()<10)
    {
      seconde="0"+d.getSeconds();
    }

    var fileName=d.getFullYear()+"-"+mois+"-"+date+"-"+heure+"h"+minute+"mn"+seconde+"s";
    fs.writeFile('save/'+fileName, JSON.stringify(data), function(err) {
      if (err) throw err;
      console.log('It\'s saved!');
      socket.emit("files", {name:fileName, data:data})
    });
  });

  socket.on("shutdown", function(){
    var exec = require('child_process').exec;
    serial_chipkit.close();
    exec('sudo shutdown -h now', function (err, stdout, stderr) {});
  });

});






//Acquisition des donnees !
var SerialPort = require("serialport").SerialPort;

//var serial_chipkit = new SerialPort("/dev/tty.usbserial-AJV9IKME", {baudrate: 1152000}, false);
var serial_chipkit = new SerialPort("/dev/ttyUSB0", {baudrate: 115200}, false);

var pixel=[];
var global_data=[];

serial_chipkit.open( function (error) {
  console.log("Serial port opened !");

		serial_chipkit.on('data', function (data) {
			//data reçu on va les traiter!
      //console.log(data);
      //console.log(data.length);
      for(var i=0; i<data.length; i++){
        if(data[i]==76)
        {
          console.log("début");
          global_data=[];
          pixel=[];
        }
        else if(data[i]==90)
        {
          console.log("fin");
          decode_data_32();
        }
        else {
          global_data.push(identify_char_32_value(data[i]));
        }
      }
		});

	});

serial_chipkit.on('close', function(error){
	console.log("connection with chipkit has been closed !");
});

serial_chipkit.on('error', function(){
	console.log("connection with chipkit has encounter an error ! ");
});

function identify_char_32_value(value){
  if(value>=32 && value<=57){
    return value-32; //start at 0;
  }
  else if(value>=65 && value<=70){
    return value-39; //start at 10;
  }
}

function identify_char_16_value(value){
  if(value>=48 && value<=57){
    return value-48; //start at 0;
  }
  else if(value>=65 && value<=70){
    return value-55; //start at 10;
  }
}

var lastTime=0;
function decode_data_32(){
  for(var i=0; i<global_data.length; i+=2)
  {
    var mon_pixel=0;
    mon_pixel+=global_data[i]*32;
    mon_pixel+=global_data[i+1];

    //we inverse the direction of the graph...
    pixel.push([i/2,1000-mon_pixel]);
  }

  io.sockets.emit("newData", pixel);
  console.log(pixel.length);
  //time
  var date = new Date();
  var currentTime = date.getTime();
  console.log("Time:"+(currentTime-lastTime));
  lastTime=currentTime;
}

function decode_data_16(){
  for(var i=0; i<global_data.length; i+=4)
  {
    var mon_pixel=0;
    mon_pixel+=global_data[i]*4096;
    mon_pixel+=global_data[i+1]*256;
    mon_pixel+=global_data[i+2]*16;
    mon_pixel+=global_data[i+3];

    //we inverse the direction of the graph...
    pixel.push([i/4,1000-mon_pixel]);
  }

  io.sockets.emit("newData", pixel);
  console.log(pixel.length);
  //time
  var date = new Date();
  var currentTime = date.getTime();
  console.log("Time:"+(currentTime-lastTime));
  lastTime=currentTime;
}

//setTimeout(function(){newAcquisition()}, 2000);
function newAcquisition(temporisation){
  console.log("new Acquisition "+temporisation);
  serial_chipkit.write("<d>m;"+temporisation+"</d>");
  //setTimeout(function(){newAcquisition()}, 2000);
}


/*
setTimeout(function(){falsePixel()}, 1000);

function falsePixel(){

  var mesPixels=[];
  for(var i=0; i<2048; i++){
    mesPixels.push([i,Math.floor(Math.random()*340+160)]);
  }

  io.sockets.emit("newData", mesPixels);
  setTimeout(function(){falsePixel()}, 1000);
}*/
